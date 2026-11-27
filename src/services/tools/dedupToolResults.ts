import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { DEFAULT_MAX_RESULT_SIZE_CHARS } from '../../constants/toolLimits.js'
import type { Message } from '../../types/message.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'
import { logEvent } from '../analytics/index.js'
import { sanitizeToolNameForAnalytics } from '../analytics/metadata.js'

/**
 * Identical tool results within a session are replaced by a back-reference to
 * the first occurrence, which is tagged with [result-id: rN].
 */
export type ToolResultDedupState = {
  seen: Map<string, { shortId: string; toolName: string }>
  counter: number
}

// Results at or below this length are never deduped
const MIN_DEDUP_LENGTH = 256

const RESULT_ID_MARKER_RE = /\[result-id: r(\d+)\]$/

export function createToolResultDedupState(): ToolResultDedupState {
  return { seen: new Map(), counter: 0 }
}

/**
 * Rebuild dedup state for a resumed conversation: continue numbering after
 * the highest [result-id: rN] already present in the messages.
 */
export function restoreToolResultDedupState(
  messages: Message[],
): ToolResultDedupState {
  let counter = 0
  for (const message of messages) {
    if (message.type !== 'user' || !Array.isArray(message.message.content)) {
      continue
    }
    for (const block of message.message.content) {
      if (block.type !== 'tool_result' || typeof block.content !== 'string') {
        continue
      }
      const match = RESULT_ID_MARKER_RE.exec(block.content)
      if (match) counter = Math.max(counter, Number(match[1]))
    }
  }
  return { seen: new Map(), counter }
}

export function dedupToolResult(
  block: ToolResultBlockParam,
  toolName: string,
  state: ToolResultDedupState | undefined,
  maxResultSizeChars: number,
): ToolResultBlockParam {
  if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_onyx_basin_m1k', false)) {
    return block
  }
  if (!state) return block
  if (block.is_error) return block
  const content = block.content
  if (typeof content !== 'string') return block
  const length = content.length
  if (length <= MIN_DEDUP_LENGTH) return block
  const limit = Math.min(maxResultSizeChars, DEFAULT_MAX_RESULT_SIZE_CHARS)
  if (length >= limit) return block

  const hash = hashContent(content)
  const previous = state.seen.get(hash)
  if (previous) {
    const reference = `<identical to result [${previous.shortId}] from your ${previous.toolName} call earlier — refer to that output>`
    logEvent('tengu_tool_result_dedup', {
      hit: true,
      toolName: sanitizeToolNameForAnalytics(toolName),
      originalBytes: length,
      savedBytes: length - reference.length,
    })
    return { ...block, content: reference }
  }

  state.counter += 1
  const shortId = `r${state.counter}`
  state.seen.set(hash, { shortId, toolName })
  logEvent('tengu_tool_result_dedup', {
    hit: false,
    toolName: sanitizeToolNameForAnalytics(toolName),
    originalBytes: length,
    savedBytes: 0,
  })
  return { ...block, content: `${content}\n[result-id: ${shortId}]` }
}

function hashContent(content: string): string {
  if (typeof Bun !== 'undefined') return Bun.hash(content).toString(36)
  // djb2
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}
