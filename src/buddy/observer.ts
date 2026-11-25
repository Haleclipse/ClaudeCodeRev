import { readFile } from 'fs/promises'
import { join } from 'path'
import type { Message } from '../types/message.js'
import { getGlobalConfig } from '../utils/config.js'
import { getCwd } from '../utils/cwd.js'
import { execFileNoThrow } from '../utils/execFileNoThrow.js'
import { gitExe } from '../utils/git.js'
import { isHumanTurn } from '../utils/messagePredicates.js'
import {
  getAssistantMessageText,
  getUserMessageText,
} from '../utils/messages.js'
import { jsonParse } from '../utils/slowOperations.js'
import { type BuddyReactionReason, requestBuddyReaction } from './api.js'
import { getCompanion } from './companion.js'
import type { Companion } from './types.js'

// Unprompted reactions at most this often (being addressed, or a test
// failure / error / large diff in the turn's output, bypasses it)
const REACTION_COOLDOWN_MS = 30_000
const MAX_RECENT_REACTIONS = 3
const LARGE_DIFF_LINE_THRESHOLD = 80
const TEST_FAIL_RE =
  /\b[1-9]\d* (failed|failing)\b|\btests? failed\b|^FAIL(ED)?\b| ✗ | ✘ /im
const ERROR_RE =
  /\berror:|\bexception\b|\btraceback\b|\bpanicked at\b|\bfatal:|exit code [1-9]/i

let lastReactionAt = 0
// Messages already scanned for tool output, so each turn only looks at new ones
let lastScannedMessageCount = 0

// Recent conversation, compressed to "user: … / claude: …" lines plus the
// tail of any tool output — what the companion gets to react to.
function buildTranscript(messages: Message[], toolOutput: string): string {
  const lines: string[] = []
  const recent = messages.slice(-12)
  for (const message of recent) {
    if (message.type !== 'user' && message.type !== 'assistant') continue
    if (message.isMeta) continue
    const text =
      message.type === 'user'
        ? getUserMessageText(message)
        : getAssistantMessageText(message)
    if (text) {
      lines.push(
        `${message.type === 'user' ? 'user' : 'claude'}: ${text.slice(0, 300)}`,
      )
    }
  }
  if (toolOutput) {
    lines.push(`[tool output]\n${toolOutput.slice(-1000)}`)
  }
  return lines.join('\n')
}

function collectToolResultText(messages: Message[]): string {
  const texts: string[] = []
  for (const message of messages) {
    if (message.type !== 'user') continue
    const content = message.message.content
    if (typeof content === 'string') continue
    for (const block of content) {
      if (block.type !== 'tool_result') continue
      const result = block.content
      if (typeof result === 'string') {
        texts.push(result)
      } else if (Array.isArray(result)) {
        for (const part of result) {
          if (part.type === 'text') texts.push(part.text)
        }
      }
    }
  }
  return texts.join('\n')
}

// Something worth an unprompted comment in this turn's tool output?
function detectReactionTrigger(
  toolOutput: string,
): 'test-fail' | 'error' | 'large-diff' | null {
  if (!toolOutput) return null
  if (TEST_FAIL_RE.test(toolOutput)) return 'test-fail'
  if (ERROR_RE.test(toolOutput)) return 'error'
  if (/^(@@ |diff )/m.test(toolOutput)) {
    const changedLines = toolOutput.match(/^[+-](?![+-])/gm)?.length ?? 0
    if (changedLines > LARGE_DIFF_LINE_THRESHOLD) return 'large-diff'
  }
  return null
}

// Did the user's last real message mention the companion by name?
function isCompanionAddressed(messages: Message[], name: string): boolean {
  const lastHuman = messages.findLast(isHumanTurn)
  if (!lastHuman) return false
  const text = getUserMessageText(lastHuman) ?? ''
  return new RegExp(
    `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i',
  ).test(text)
}

// The companion's last few lines, sent along so it doesn't repeat itself
const recentReactions: string[] = []

function rememberReaction(reaction: string): void {
  recentReactions.push(reaction)
  if (recentReactions.length > MAX_RECENT_REACTIONS) recentReactions.shift()
}

export function getLastReaction(): string | undefined {
  return recentReactions.at(-1)
}

/**
 * Called at the end of every turn. The companion speaks when it's addressed
 * by name, when the turn's tool output shows a test failure / error / large
 * diff, or otherwise at most once per REACTION_COOLDOWN_MS.
 */
export function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string) => void,
): void {
  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) {
    lastScannedMessageCount = messages.length
    return
  }

  const addressed = isCompanionAddressed(messages, companion.name)
  const newToolOutput = collectToolResultText(
    messages.slice(lastScannedMessageCount),
  )
  lastScannedMessageCount = messages.length
  const recentToolOutput = collectToolResultText(messages.slice(-12))
  const trigger = addressed ? null : detectReactionTrigger(newToolOutput)
  const reason: BuddyReactionReason = trigger ?? 'turn'

  const now = Date.now()
  if (!addressed && !trigger && now - lastReactionAt < REACTION_COOLDOWN_MS) {
    return
  }

  const transcript = buildTranscript(messages, recentToolOutput)
  if (!transcript.trim()) return

  lastReactionAt = now
  void requestBuddyReaction(
    companion,
    transcript,
    reason,
    recentReactions,
    addressed,
    AbortSignal.timeout(10_000),
  ).then(reaction => {
    if (!reaction) return
    rememberReaction(reaction)
    onReaction(reaction)
  })
}

/** First words after hatching, based on what the project looks like. */
export function triggerHatchReaction(
  companion: Companion,
  onReaction: (reaction: string) => void,
): void {
  if (getGlobalConfig().companionMuted) return
  lastReactionAt = Date.now()
  void getProjectContext()
    .then(context =>
      requestBuddyReaction(
        companion,
        context || '(fresh project, nothing to see yet)',
        'hatch',
        [],
        false,
        AbortSignal.timeout(10_000),
      ),
    )
    .then(reaction => {
      if (!reaction) return
      rememberReaction(reaction)
      onReaction(reaction)
    })
    .catch(() => {})
}

/** `/buddy pet` */
export function triggerPetReaction(
  onReaction: (reaction: string) => void,
): void {
  const companion = getCompanion()
  if (!companion) return
  lastReactionAt = Date.now()
  void requestBuddyReaction(
    companion,
    '(you were just petted)',
    'pet',
    recentReactions,
    false,
    AbortSignal.timeout(10_000),
  ).then(reaction => {
    if (!reaction) return
    rememberReaction(reaction)
    onReaction(reaction)
  })
}

// package.json name/description + the last few commits
async function getProjectContext(): Promise<string> {
  const cwd = getCwd()
  const [packageJson, gitLog] = await Promise.allSettled([
    readFile(join(cwd, 'package.json'), 'utf-8'),
    execFileNoThrow(
      gitExe(),
      ['--no-optional-locks', 'log', '--oneline', '-n', '3'],
      { preserveOutputOnError: false, useCwd: true },
    ),
  ])
  const parts: string[] = []
  if (packageJson.status === 'fulfilled') {
    try {
      const pkg = jsonParse(packageJson.value) as {
        name?: string
        description?: string
      }
      if (pkg.name) {
        parts.push(
          `project: ${pkg.name}${pkg.description ? ` — ${pkg.description}` : ''}`,
        )
      }
    } catch {
      // Not JSON — ignore
    }
  }
  if (gitLog.status === 'fulfilled') {
    const commits = gitLog.value.stdout.trim()
    if (commits) parts.push(`recent commits:\n${commits}`)
  }
  return parts.join('\n')
}
