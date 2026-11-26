import type Anthropic from '@anthropic-ai/sdk'
import type { MemoryHeader } from './memoryScan.js'

type MessageParam = Anthropic.MessageParam
type CacheControlEphemeral = Anthropic.CacheControlEphemeral

/**
 * Relevant-memory selector conversation for one memory directory. The first
 * user message is the memory manifest; each later query/selection pair is
 * appended so the next selection reuses the cached prefix.
 */
export type MemorySelectorDirState = {
  memories: MemoryHeader[]
  byFilename: Map<string, MemoryHeader>
  messages: MessageParam[]
}

export type MemorySelectorUsage = {
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  turnCount: number
}

/**
 * Session-scoped selector state, keyed by memory directory. Owned by the
 * REPL / QueryEngine / subagent / teammate context; reset on clear and compact.
 */
export type MemorySelector = {
  stateByDir: Map<string, MemorySelectorDirState>
  /** Usage of the most recent selection query, for prefetch telemetry. */
  lastUsage: MemorySelectorUsage | null
}

export function createMemorySelector(): MemorySelector {
  return { stateByDir: new Map(), lastUsage: null }
}

export function resetMemorySelector(selector: MemorySelector | undefined): void {
  if (!selector) return
  selector.stateByDir.clear()
  selector.lastUsage = null
}

export function getMemorySelectorDirState(
  selector: MemorySelector,
  memoryDir: string,
): MemorySelectorDirState | undefined {
  return selector.stateByDir.get(memoryDir)
}

export function initMemorySelectorDirState(
  selector: MemorySelector,
  memoryDir: string,
  memories: MemoryHeader[],
  manifest: string,
  cacheControl?: CacheControlEphemeral,
): MemorySelectorDirState {
  const state: MemorySelectorDirState = {
    memories,
    byFilename: new Map(memories.map(m => [m.filename, m])),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Available memories:\n${manifest}`,
            ...(cacheControl && { cache_control: cacheControl }),
          },
        ],
      },
    ],
  }
  selector.stateByDir.set(memoryDir, state)
  return state
}

/** Append one query and the model's selection as a user/assistant pair. */
export function appendMemorySelectorTurn(
  selector: MemorySelector,
  memoryDir: string,
  query: string,
  response: string,
): void {
  const state = selector.stateByDir.get(memoryDir)
  if (!state) return
  selector.stateByDir.set(memoryDir, {
    ...state,
    messages: [
      ...state.messages,
      { role: 'user', content: [{ type: 'text', text: query }] },
      { role: 'assistant', content: [{ type: 'text', text: response }] },
    ],
  })
}

export const MEMORY_SELECTOR_QUERY_SOURCE = 'memdir_relevance'
