import type Anthropic from '@anthropic-ai/sdk'
import { feature } from 'bun:bundle'
import { logForDebugging } from '../utils/debug.js'
import { errorMessage } from '../utils/errors.js'
import { getDefaultSonnetModel } from '../utils/model/model.js'
import { sideQuery } from '../utils/sideQuery.js'
import { jsonParse } from '../utils/slowOperations.js'
import {
  formatMemoryManifest,
  type MemoryHeader,
  scanMemoryFiles,
} from './memoryScan.js'
import {
  appendMemorySelectorTurn,
  getMemorySelectorDirState,
  initMemorySelectorDirState,
  MEMORY_SELECTOR_QUERY_SOURCE,
  type MemorySelector,
} from './memorySelector.js'

type MessageParam = Anthropic.MessageParam

export type RelevantMemory = {
  path: string
  mtimeMs: number
}

const SELECT_MEMORIES_SYSTEM_PROMPT = `You are selecting memories that will be useful to Claude Code as it processes a user's query. The first message lists the available memory files with their filenames and descriptions; subsequent messages each contain one user query.

Return a list of filenames for the memories that will clearly be useful to Claude Code as it processes the user's query (up to 5). Only include memories that you are certain will be helpful based on their name and description.
- If you are unsure if a memory will be useful in processing the user's query, then do not include it in your list. Be selective and discerning.
- If there are no memories in the list that would clearly be useful, feel free to return an empty list.
- Be especially conservative with user-profile and project-overview memories ([user], [project]). These describe the user's ongoing focus, not what every question is about. A profile saying "works on DB performance" is NOT relevant to a question that merely contains the word "performance" unless the question is actually about that DB work. Match on what the question IS ABOUT, not on surface keyword overlap with who the user is.
- Do not re-select memories you already returned for an earlier query in this conversation.
`

/**
 * Find memory files relevant to a query by asking Sonnet to select from the
 * memory file headers.
 *
 * Returns absolute file paths + mtime of the most relevant memories
 * (up to 5). Excludes MEMORY.md (already loaded in system prompt).
 * mtime is threaded through so callers can surface freshness to the
 * main model without a second stat.
 *
 * The selection runs as a multi-turn conversation kept in `selector`, one per
 * memory directory: the manifest is scanned once and sent as the first
 * (cached) message, and each call appends its query. `alreadySurfaced`
 * short-circuits when every listed memory was already shown and is
 * filtered out of the selection.
 */
export async function findRelevantMemories(
  query: string,
  memoryDir: string,
  selector: MemorySelector,
  signal: AbortSignal,
  alreadySurfaced: ReadonlySet<string> = new Set(),
): Promise<RelevantMemory[]> {
  selector.lastUsage = null
  const cacheControl = { type: 'ephemeral' as const }
  const state =
    getMemorySelectorDirState(selector, memoryDir) ??
    (await scanMemoryFiles(memoryDir, signal).then(memories =>
      memories.length > 0 && !signal.aborted
        ? initMemorySelectorDirState(
            selector,
            memoryDir,
            memories,
            formatMemoryManifest(memories),
            cacheControl,
          )
        : undefined,
    ))
  if (!state || state.memories.every(m => alreadySurfaced.has(m.filePath))) {
    return []
  }

  const selectedFilenames = await selectRelevantMemories(
    query,
    memoryDir,
    selector,
    state.messages,
    state.byFilename,
    cacheControl,
    signal,
  )
  const selected = selectedFilenames
    .map(filename => state.byFilename.get(filename))
    .filter(
      (m): m is MemoryHeader =>
        m !== undefined && !alreadySurfaced.has(m.filePath),
    )

  // Fires even on empty selection: selection-rate needs the denominator,
  // and -1 ages distinguish "ran, picked nothing" from "never ran".
  if (feature('MEMORY_SHAPE_TELEMETRY')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { logMemoryRecallShape } =
      require('./memoryShapeTelemetry.js') as typeof import('./memoryShapeTelemetry.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    logMemoryRecallShape(state.memories, selected)
  }

  return selected.map(m => ({ path: m.filePath, mtimeMs: m.mtimeMs }))
}

async function selectRelevantMemories(
  query: string,
  memoryDir: string,
  selector: MemorySelector,
  priorMessages: MessageParam[],
  byFilename: ReadonlyMap<string, MemoryHeader>,
  cacheControl: { type: 'ephemeral' },
  signal: AbortSignal,
): Promise<string[]> {
  const queryText = `Select memories relevant to:\n${query}`

  try {
    const result = await sideQuery({
      model: getDefaultSonnetModel(),
      system: [
        {
          type: 'text',
          text: SELECT_MEMORIES_SYSTEM_PROMPT,
          cache_control: cacheControl,
        },
      ],
      skipSystemPromptPrefix: true,
      messages: [
        ...priorMessages,
        {
          role: 'user',
          content: [
            { type: 'text', text: queryText, cache_control: cacheControl },
          ],
        },
      ],
      max_tokens: 256,
      output_format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            selected_memories: { type: 'array', items: { type: 'string' } },
          },
          required: ['selected_memories'],
          additionalProperties: false,
        },
      },
      signal,
      querySource: MEMORY_SELECTOR_QUERY_SOURCE,
    })

    const textBlock = result.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return []
    }

    const parsed: { selected_memories: string[] } = jsonParse(textBlock.text)
    // Keep the exchange so the next query in this session extends the
    // cached conversation.
    appendMemorySelectorTurn(selector, memoryDir, queryText, textBlock.text)
    selector.lastUsage = {
      cacheReadInputTokens: result.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: result.usage.cache_creation_input_tokens ?? 0,
      turnCount: (priorMessages.length + 1) / 2,
    }
    return parsed.selected_memories.filter(f => byFilename.has(f))
  } catch (e) {
    selector.lastUsage = null
    if (signal.aborted) {
      return []
    }
    logForDebugging(
      `[memdir] selectRelevantMemories failed: ${errorMessage(e)}`,
      { level: 'warn' },
    )
    return []
  }
}
