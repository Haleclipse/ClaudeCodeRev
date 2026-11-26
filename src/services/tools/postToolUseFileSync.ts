import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import type { AttachmentMessage } from '../../types/message.js'
import { createAttachmentMessage } from '../../utils/attachments.js'
import { logForDebugging } from '../../utils/debug.js'
import { getFileModificationTime } from '../../utils/file.js'
import { readFileSyncWithMetadata } from '../../utils/fileRead.js'
import type { FileStateCache } from '../../utils/fileStateCache.js'
import { expandPath } from '../../utils/path.js'

/**
 * After PostToolUse hooks ran for an Edit/Write, re-sync readFileState with
 * the file on disk if a hook (typically a format-on-save formatter) rewrote
 * it. Without this, the next Edit of the same file fails with "File content
 * has changed" because the recorded mtime/content predate the hook's write.
 *
 * Only full-file reads are refreshed (partial reads keep their offset/limit
 * and stay stale). Returns an attachment telling the model the file was
 * reformatted when the content actually changed; null otherwise.
 */
export function resyncFileStateAfterPostToolUse(
  toolName: string,
  toolUseID: string,
  input: unknown,
  readFileState: FileStateCache,
): AttachmentMessage | null {
  if (toolName !== FILE_EDIT_TOOL_NAME && toolName !== FILE_WRITE_TOOL_NAME) {
    return null
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('file_path' in input) ||
    typeof input.file_path !== 'string'
  ) {
    return null
  }
  try {
    const filePath = expandPath(input.file_path)
    const entry = readFileState.get(filePath)
    if (!entry || entry.offset !== undefined || entry.limit !== undefined) {
      return null
    }
    const mtime = getFileModificationTime(filePath)
    if (mtime <= entry.timestamp) {
      return null
    }
    const fresh = readFileSyncWithMetadata(filePath)
    readFileState.set(filePath, {
      content: fresh.content,
      timestamp: mtime,
      offset: undefined,
      limit: undefined,
    })
    if (fresh.content === entry.content) {
      return null
    }
    logForDebugging(
      `PostToolUse hook modified ${filePath} after ${toolName} — re-synced readFileState`,
      { level: 'info' },
    )
    return createAttachmentMessage({
      type: 'hook_additional_context',
      content: [
        `PostToolUse hook modified ${filePath} after your edit (likely a formatter). Your next Edit will not fail with a stale-file error, but if its old_string targets a region the hook reformatted, Read the file first.`,
      ],
      hookName: `PostToolUse:${toolName}`,
      toolUseID,
      hookEvent: 'PostToolUse',
    })
  } catch {
    return null
  }
}
