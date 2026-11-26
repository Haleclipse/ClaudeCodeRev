import { readFile, stat } from 'fs/promises'
import { getSessionId } from '../bootstrap/state.js'
import type { AgentId } from '../types/ids.js'
import { logForDebugging } from '../utils/debug.js'
import { isENOENT } from '../utils/errors.js'
import { isCompactBoundaryMessage } from '../utils/messages.js'
import {
  getAgentTranscriptPath,
  getTranscriptPathForSession,
} from '../utils/sessionStorage.js'
import { SKIP_PRECOMPACT_THRESHOLD } from '../utils/sessionStoragePortable.js'
import { jsonParse } from '../utils/slowOperations.js'
import type {
  InternalEventReaders,
  InternalEventWriter,
} from './replBridgeTransport.js'

/**
 * Persistence sync for Remote Control session persistence.
 *
 * When a CCR v2 transport comes up, the server may be missing transcript
 * entries written locally while no internal-event writer was installed
 * (before the bridge connected, or across a reconnect). Before the writer is
 * installed, compare the server's internal events since the last compaction
 * with the local main-session and subagent transcripts and upload whatever
 * the server doesn't have yet.
 */

type UploadableEntry = Record<string, unknown> & { type: string; uuid: string }

// Transcript entry types that are forwarded as internal events.
const UPLOADABLE_ENTRY_TYPES = new Set([
  'user',
  'assistant',
  'attachment',
  'system',
])

export async function syncTranscriptToServer(
  write: InternalEventWriter,
  readers: InternalEventReaders,
  subagentIds: string[],
): Promise<{ uploadedMain: number; uploadedSubagents: number }> {
  const [mainEvents, subagentEvents] = await Promise.all([
    readers.readMain(),
    readers.readSubagents(),
  ])
  const serverUuids = new Set<string>()
  for (const event of mainEvents ?? []) {
    const uuid = event.payload.uuid
    if (typeof uuid === 'string') serverUuids.add(uuid)
  }
  for (const event of subagentEvents ?? []) {
    const uuid = event.payload.uuid
    if (typeof uuid === 'string') serverUuids.add(uuid)
  }
  logForDebugging(
    `[persistence-sync] Server has ${serverUuids.size} events since compaction`,
  )

  // Fire-and-forget: the writer queues; a failed upload is only logged.
  const onWriteError = (err: unknown) => {
    logForDebugging(`[persistence-sync] Write failed: ${err}`)
  }

  const mainEntries = await readEntriesMissingOnServer(
    getTranscriptPathForSession(getSessionId()),
    serverUuids,
  )
  for (const entry of mainEntries) {
    write('transcript', entry, {
      ...(isCompactBoundaryMessage(entry as never) && { isCompaction: true }),
    }).catch(onWriteError)
  }

  let uploadedSubagents = 0
  for (const agentId of subagentIds) {
    const entries = await readEntriesMissingOnServer(
      getAgentTranscriptPath(agentId as AgentId),
      serverUuids,
    )
    for (const entry of entries) {
      write('transcript', entry, {
        ...(isCompactBoundaryMessage(entry as never) && { isCompaction: true }),
        agentId,
      }).catch(onWriteError)
    }
    uploadedSubagents += entries.length
  }

  logForDebugging(
    `[persistence-sync] Uploaded ${mainEntries.length} main + ${uploadedSubagents} subagent entries`,
  )
  return { uploadedMain: mainEntries.length, uploadedSubagents }
}

/**
 * Uploadable entries after the last compact boundary in a transcript file
 * whose uuid the server doesn't have. Missing files yield nothing; files over
 * SKIP_PRECOMPACT_THRESHOLD are skipped rather than read whole.
 */
async function readEntriesMissingOnServer(
  path: string,
  serverUuids: Set<string>,
): Promise<UploadableEntry[]> {
  let size: number
  try {
    size = (await stat(path)).size
  } catch (e) {
    if (isENOENT(e)) return []
    throw e
  }
  if (size > SKIP_PRECOMPACT_THRESHOLD) {
    logForDebugging(
      `[persistence-sync] Skipping ${path} — ${size} bytes exceeds ${SKIP_PRECOMPACT_THRESHOLD} threshold`,
    )
    return []
  }
  let content: string
  try {
    content = await readFile(path, 'utf8')
  } catch (e) {
    if (isENOENT(e)) return []
    throw e
  }
  const lines = content.split('\n').filter(Boolean)
  const entries: UploadableEntry[] = []
  let lastBoundaryIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    let parsed: unknown
    try {
      parsed = jsonParse(line)
    } catch {
      continue
    }
    if (!isUploadableEntry(parsed)) continue
    entries.push(parsed)
    if (isCompactBoundaryMessage(parsed as never)) {
      lastBoundaryIndex = entries.length - 1
    }
  }
  return entries
    .slice(lastBoundaryIndex + 1)
    .filter(entry => !serverUuids.has(entry.uuid))
}

function isUploadableEntry(value: unknown): value is UploadableEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    UPLOADABLE_ENTRY_TYPES.has(value.type as string) &&
    'uuid' in value &&
    typeof value.uuid === 'string'
  )
}
