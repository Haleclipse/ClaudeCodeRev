import { feature } from 'bun:bundle'
import { markPostCompaction } from 'src/bootstrap/state.js'
import {
  getLastInteractionTime,
  getSdkBetas,
} from '../../bootstrap/state.js'
import type { QuerySource } from '../../constants/querySource.js'
import type { ToolUseContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import { getGlobalConfig } from '../../utils/config.js'
import { getContextWindowForModel } from '../../utils/context.js'
import { logForDebugging } from '../../utils/debug.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { validateBoundedIntEnvVar } from '../../utils/envValidation.js'
import { hasExactErrorMessage } from '../../utils/errors.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import { logError } from '../../utils/log.js'
import { tokenCountWithEstimation } from '../../utils/tokens.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'
import { getMaxOutputTokensForModel } from '../api/claude.js'
import { notifyCompaction } from '../api/promptCacheBreakDetection.js'
import { setLastSummarizedMessageId } from '../SessionMemory/sessionMemoryUtils.js'
import {
  type CompactionResult,
  compactConversation,
  ERROR_MESSAGE_USER_ABORT,
  type RecompactionInfo,
} from './compact.js'
import { runPostCompactCleanup } from './postCompactCleanup.js'
import { trySessionMemoryCompaction } from './sessionMemoryCompact.js'

// Reserve this many tokens for output during compaction
// Based on p99.99 of compact summary output being 17,387 tokens.
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000

// Allowed range for a configured auto-compact window (/autocompact,
// settings.autoCompactWindow, CLAUDE_CODE_AUTO_COMPACT_WINDOW)
export const AUTOCOMPACT_WINDOW_MIN = 100_000
export const AUTOCOMPACT_WINDOW_MAX = 1_000_000

/**
 * Parses a user-supplied auto-compact window: "500k", "1m", "200000", or a
 * bare 100–1000 meaning thousands of tokens. Returns undefined when the value
 * is not a number or falls outside AUTOCOMPACT_WINDOW_MIN..MAX.
 */
export function parseAutoCompactWindow(input: string): number | undefined {
  const normalized = input.trim().toLowerCase()
  let tokens: number
  if (normalized.endsWith('m')) {
    tokens = parseFloat(normalized) * 1_000_000
  } else if (normalized.endsWith('k')) {
    tokens = parseFloat(normalized) * 1_000
  } else {
    const parsed = parseInt(normalized, 10)
    tokens = parsed >= 100 && parsed <= 1000 ? parsed * 1_000 : parsed
  }
  if (
    !Number.isFinite(tokens) ||
    tokens < AUTOCOMPACT_WINDOW_MIN ||
    tokens > AUTOCOMPACT_WINDOW_MAX
  ) {
    return undefined
  }
  return Math.round(tokens)
}

export type AutoCompactWindowSource = 'env' | 'settings' | 'model'

/**
 * Resolves the window auto-compact works against.
 * Precedence: CLAUDE_CODE_AUTO_COMPACT_WINDOW > settings (autoCompactWindow,
 * via AppState) > the model's context window. A configured value is always
 * capped at the model's context window; `configured` keeps the uncapped value
 * so callers can tell the user it was clamped.
 */
export function resolveAutoCompactWindow(
  model: string,
  autoCompactWindow: number | undefined,
): { window: number; configured: number; source: AutoCompactWindowSource } {
  const modelWindow = getContextWindowForModel(model, getSdkBetas())
  if (process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) {
    const validated = validateBoundedIntEnvVar(
      'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
      process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW,
      AUTOCOMPACT_WINDOW_MIN,
      AUTOCOMPACT_WINDOW_MAX,
    )
    if (validated.status !== 'invalid') {
      const configured = Math.max(AUTOCOMPACT_WINDOW_MIN, validated.effective)
      return {
        window: Math.min(modelWindow, configured),
        configured,
        source: 'env',
      }
    }
  }
  if (autoCompactWindow !== undefined) {
    return {
      window: Math.min(modelWindow, autoCompactWindow),
      configured: autoCompactWindow,
      source: 'settings',
    }
  }
  return { window: modelWindow, configured: modelWindow, source: 'model' }
}

// Returns the context window size minus the max output tokens for the model.
// The configured auto-compact window is ignored when auto-compact is off.
export function getEffectiveContextWindowSize(
  model: string,
  autoCompactWindow?: number,
): number {
  const reservedTokensForSummary = Math.min(
    getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY,
  )
  const configuredWindow = isAutoCompactEnabled()
    ? autoCompactWindow
    : undefined
  const { window } = resolveAutoCompactWindow(model, configuredWindow)
  return window - reservedTokensForSummary
}

// "Cold" compaction: the user has been away long enough that the prompt
// cache has certainly expired, so there's no cached prefix worth preserving.
function isColdCompactIdle(): boolean {
  return Date.now() - getLastInteractionTime() >= COLD_COMPACT_IDLE_MS
}

export type AutoCompactTrackingState = {
  compacted: boolean
  turnCounter: number
  // Unique ID per turn
  turnId: string
  // Consecutive autocompact failures. Reset on success.
  // Used as a circuit breaker to stop retrying when the context is
  // irrecoverably over the limit (e.g., prompt_too_long).
  consecutiveFailures?: number
  // Consecutive compactions that each followed the previous one within
  // RAPID_REFILL_TURN_THRESHOLD turns (context refills right after compacting).
  consecutiveRapidRefills?: number
}

export const AUTOCOMPACT_BUFFER_TOKENS = 13_000
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000

// Stop trying autocompact after this many consecutive failures.
// BQ 2026-03-10: 1,279 sessions had 50+ consecutive failures (up to 3,272)
// in a single session, wasting ~250K API calls/day globally.
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// Rapid-refill breaker: if the context fills back up to the threshold within
// this many turns of the previous compact, MAX_CONSECUTIVE_RAPID_REFILLS times
// in a row, compacting is just burning API calls (something re-adds the bulk
// every turn — usually a huge file read or tool output). Stop and tell the user.
const RAPID_REFILL_TURN_THRESHOLD = 3
const MAX_CONSECUTIVE_RAPID_REFILLS = 3

export const RAPID_REFILL_BREAKER_MESSAGE = `Autocompact is thrashing: the context refilled to the limit within ${RAPID_REFILL_TURN_THRESHOLD} turns of the previous compact, ${MAX_CONSECUTIVE_RAPID_REFILLS} times in a row. A file being read or a tool output is likely too large for the context window. Try reading in smaller chunks, or use /clear to start fresh.`

// Idle time after which an autocompact is done "cold" (see isColdCompactIdle)
const COLD_COMPACT_IDLE_MS = 90 * 60 * 1000

export function getAutoCompactThreshold(
  model: string,
  autoCompactWindow?: number,
): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(
    model,
    autoCompactWindow,
  )

  const autocompactThreshold =
    effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS

  // Override for easier testing of autocompact
  const envPercent = process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
  if (envPercent) {
    const parsed = parseFloat(envPercent)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      const percentageThreshold = Math.floor(
        effectiveContextWindow * (parsed / 100),
      )
      return Math.min(percentageThreshold, autocompactThreshold)
    }
  }

  return autocompactThreshold
}

export function calculateTokenWarningState(
  tokenUsage: number,
  model: string,
  autoCompactWindow?: number,
): {
  percentLeft: number
  isAboveWarningThreshold: boolean
  isAboveErrorThreshold: boolean
  isAboveAutoCompactThreshold: boolean
  isAtBlockingLimit: boolean
} {
  const autoCompactEnabled = isAutoCompactEnabled()
  // The configured window only applies while auto-compact is on
  const configuredWindow = autoCompactEnabled ? autoCompactWindow : undefined
  const autoCompactThreshold = getAutoCompactThreshold(model, configuredWindow)
  const threshold = autoCompactEnabled
    ? autoCompactThreshold
    : getEffectiveContextWindowSize(model, configuredWindow)

  const percentLeft = Math.max(
    0,
    Math.round(((threshold - tokenUsage) / threshold) * 100),
  )

  const warningThreshold = threshold - WARNING_THRESHOLD_BUFFER_TOKENS
  const errorThreshold = threshold - ERROR_THRESHOLD_BUFFER_TOKENS

  const isAboveWarningThreshold = tokenUsage >= warningThreshold
  const isAboveErrorThreshold = tokenUsage >= errorThreshold

  const isAboveAutoCompactThreshold =
    autoCompactEnabled && tokenUsage >= autoCompactThreshold

  const actualContextWindow = getEffectiveContextWindowSize(
    model,
    configuredWindow,
  )
  const defaultBlockingLimit =
    actualContextWindow - MANUAL_COMPACT_BUFFER_TOKENS

  // Allow override for testing
  const blockingLimitOverride = process.env.CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE
  const parsedOverride = blockingLimitOverride
    ? parseInt(blockingLimitOverride, 10)
    : NaN
  const blockingLimit =
    !isNaN(parsedOverride) && parsedOverride > 0
      ? parsedOverride
      : defaultBlockingLimit

  const isAtBlockingLimit = tokenUsage >= blockingLimit

  return {
    percentLeft,
    isAboveWarningThreshold,
    isAboveErrorThreshold,
    isAboveAutoCompactThreshold,
    isAtBlockingLimit,
  }
}

export function isAutoCompactEnabled(): boolean {
  if (isEnvTruthy(process.env.DISABLE_COMPACT)) {
    return false
  }
  // Allow disabling just auto-compact (keeps manual /compact working)
  if (isEnvTruthy(process.env.DISABLE_AUTO_COMPACT)) {
    return false
  }
  // Check if user has disabled auto-compact in their settings
  const userConfig = getGlobalConfig()
  return userConfig.autoCompactEnabled
}

export async function shouldAutoCompact(
  messages: Message[],
  model: string,
  autoCompactWindow: number | undefined,
  querySource?: QuerySource,
  // Snip removes messages but the surviving assistant's usage still reflects
  // pre-snip context, so tokenCountWithEstimation can't see the savings.
  // Subtract the rough-delta that snip already computed.
  snipTokensFreed = 0,
): Promise<boolean> {
  // Recursion guards. session_memory and compact are forked agents that
  // would deadlock.
  if (querySource === 'session_memory' || querySource === 'compact') {
    return false
  }
  // marble_origami is the ctx-agent — if ITS context blows up and
  // autocompact fires, runPostCompactCleanup calls resetContextCollapse()
  // which destroys the MAIN thread's committed log (module-level state
  // shared across forks). Inside feature() so the string DCEs from
  // external builds (it's in excluded-strings.txt).
  if (feature('CONTEXT_COLLAPSE')) {
    if (querySource === 'marble_origami') {
      return false
    }
  }

  if (!isAutoCompactEnabled()) {
    return false
  }

  // Reactive-only mode: suppress proactive autocompact, let reactive compact
  // catch the API's prompt-too-long. feature() wrapper keeps the flag string
  // out of external builds (REACTIVE_COMPACT is ant-only).
  // Note: returning false here also means autoCompactIfNeeded never reaches
  // trySessionMemoryCompaction in the query loop — the /compact call site
  // still tries session memory first. Revisit if reactive-only graduates.
  if (feature('REACTIVE_COMPACT')) {
    if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_raccoon', false)) {
      return false
    }
  }

  // Context-collapse mode: same suppression. Collapse IS the context
  // management system when it's on — the 90% commit / 95% blocking-spawn
  // flow owns the headroom problem. Autocompact firing at effective-13k
  // (~93% of effective) sits right between collapse's commit-start (90%)
  // and blocking (95%), so it would race collapse and usually win, nuking
  // granular context that collapse was about to save. Gating here rather
  // than in isAutoCompactEnabled() keeps reactiveCompact alive as the 413
  // fallback (it consults isAutoCompactEnabled directly) and leaves
  // sessionMemory + manual /compact working.
  //
  // Consult isContextCollapseEnabled (not the raw gate) so the
  // CLAUDE_CONTEXT_COLLAPSE env override is honored here too. require()
  // inside the block breaks the init-time cycle (this file exports
  // getEffectiveContextWindowSize which collapse's index imports).
  if (feature('CONTEXT_COLLAPSE')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { isContextCollapseEnabled } =
      require('../contextCollapse/index.js') as typeof import('../contextCollapse/index.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (isContextCollapseEnabled()) {
      return false
    }
  }

  const tokenCount = tokenCountWithEstimation(messages) - snipTokensFreed
  const threshold = getAutoCompactThreshold(model, autoCompactWindow)
  const effectiveWindow = getEffectiveContextWindowSize(
    model,
    autoCompactWindow,
  )

  logForDebugging(
    `autocompact: tokens=${tokenCount} threshold=${threshold} effectiveWindow=${effectiveWindow}${snipTokensFreed > 0 ? ` snipFreed=${snipTokensFreed}` : ''}`,
  )

  const { isAboveAutoCompactThreshold } = calculateTokenWarningState(
    tokenCount,
    model,
    autoCompactWindow,
  )

  return isAboveAutoCompactThreshold
}

export async function autoCompactIfNeeded(
  messages: Message[],
  toolUseContext: ToolUseContext,
  cacheSafeParams: CacheSafeParams,
  querySource?: QuerySource,
  tracking?: AutoCompactTrackingState,
  snipTokensFreed?: number,
): Promise<{
  wasCompacted: boolean
  compactionResult?: CompactionResult
  consecutiveFailures?: number
  consecutiveRapidRefills?: number
  rapidRefillBreakerTripped?: boolean
}> {
  if (isEnvTruthy(process.env.DISABLE_COMPACT)) {
    return { wasCompacted: false }
  }

  // Circuit breaker: stop retrying after N consecutive failures.
  // Without this, sessions where context is irrecoverably over the limit
  // hammer the API with doomed compaction attempts on every turn.
  if (
    tracking?.consecutiveFailures !== undefined &&
    tracking.consecutiveFailures >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES
  ) {
    return { wasCompacted: false }
  }

  const model = toolUseContext.options.mainLoopModel
  const autoCompactWindow = toolUseContext.getAppState().autoCompactWindow
  const shouldCompact = await shouldAutoCompact(
    messages,
    model,
    autoCompactWindow,
    querySource,
    snipTokensFreed,
  )

  if (!shouldCompact) {
    return { wasCompacted: false }
  }

  // Rapid-refill breaker: count this compaction as a refill if the previous
  // one was fewer than RAPID_REFILL_TURN_THRESHOLD turns ago.
  const consecutiveRapidRefills =
    tracking?.compacted === true &&
    tracking.turnCounter < RAPID_REFILL_TURN_THRESHOLD
      ? (tracking?.consecutiveRapidRefills ?? 0) + 1
      : 0
  if (consecutiveRapidRefills >= MAX_CONSECUTIVE_RAPID_REFILLS) {
    logForDebugging(
      `autocompact: rapid-refill breaker tripped — ${consecutiveRapidRefills} consecutive refills within <${RAPID_REFILL_TURN_THRESHOLD} turns each (last was ${tracking?.turnCounter} turns)`,
      { level: 'warn' },
    )
    return { wasCompacted: false, rapidRefillBreakerTripped: true }
  }

  const recompactionInfo: RecompactionInfo = {
    isRecompactionInChain: tracking?.compacted === true,
    turnsSincePreviousCompact: tracking?.turnCounter ?? -1,
    previousCompactTurnId: tracking?.turnId,
    autoCompactThreshold: getAutoCompactThreshold(model, autoCompactWindow),
    querySource,
  }

  // EXPERIMENT: Try session memory compaction first
  const sessionMemoryResult = await trySessionMemoryCompaction(
    messages,
    toolUseContext.agentId,
    recompactionInfo.autoCompactThreshold,
    false,
  )
  if (sessionMemoryResult) {
    // Reset lastSummarizedMessageId since session memory compaction prunes messages
    // and the old message UUID will no longer exist after the REPL replaces messages
    setLastSummarizedMessageId(undefined)
    runPostCompactCleanup(querySource)
    // Reset cache read baseline so the post-compact drop isn't flagged as a
    // break. compactConversation does this internally; SM-compact doesn't.
    // BQ 2026-03-01: missing this made 20% of tengu_prompt_cache_break events
    // false positives (systemPromptChanged=true, timeSinceLastAssistantMsg=-1).
    if (feature('PROMPT_CACHE_BREAK_DETECTION')) {
      notifyCompaction(querySource ?? 'compact', toolUseContext.agentId)
    }
    markPostCompaction()
    return {
      wasCompacted: true,
      compactionResult: sessionMemoryResult,
      consecutiveRapidRefills,
    }
  }

  // After a long idle the prompt cache is gone anyway: compact without the
  // cache-sharing prefix and drop non-essential attachments.
  const stripNonEssential =
    isColdCompactIdle() &&
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_cold_compact', false)

  try {
    const compactionResult = await compactConversation(
      messages,
      toolUseContext,
      cacheSafeParams,
      true, // Suppress user questions for autocompact
      undefined, // No custom instructions for autocompact
      true, // isAutoCompact
      recompactionInfo,
      stripNonEssential,
    )

    // Reset lastSummarizedMessageId since legacy compaction replaces all messages
    // and the old message UUID will no longer exist in the new messages array
    setLastSummarizedMessageId(undefined)
    runPostCompactCleanup(querySource)

    return {
      wasCompacted: true,
      compactionResult,
      // Reset failure count on success
      consecutiveFailures: 0,
      consecutiveRapidRefills,
    }
  } catch (error) {
    if (!hasExactErrorMessage(error, ERROR_MESSAGE_USER_ABORT)) {
      logError(error)
    }
    // Increment consecutive failure count for circuit breaker.
    // The caller threads this through autoCompactTracking so the
    // next query loop iteration can skip futile retry attempts.
    const prevFailures = tracking?.consecutiveFailures ?? 0
    const nextFailures = prevFailures + 1
    if (nextFailures >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES) {
      logForDebugging(
        `autocompact: circuit breaker tripped after ${nextFailures} consecutive failures — skipping future attempts this session`,
        { level: 'warn' },
      )
    }
    return { wasCompacted: false, consecutiveFailures: nextFailures }
  }
}
