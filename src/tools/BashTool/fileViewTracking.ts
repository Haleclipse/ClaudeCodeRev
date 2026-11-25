import {
  parseCommandArgv,
  splitCommand_DEPRECATED,
} from '../../utils/bash/commands.js'
import type { FileStateCache } from '../../utils/fileStateCache.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { expandPath } from '../../utils/path.js'

/**
 * A file (or line range of a file) whose content a Bash command printed
 * verbatim — the same thing the model would have seen from a Read call.
 */
type FileView = {
  filePath: string
  startLine: number | undefined
  endLine: number | undefined
}

// sed -n 'X,Yp' / sed -n 'Xp'
const SED_RANGE_PRINT_RE = /^(\d+),(\d+)p$/
const SED_LINE_PRINT_RE = /^(\d+)p$/

// Output-only commands that may accompany a view in a compound command
// (`echo "---" && cat a`) without changing what the model sees of the file.
const NEUTRAL_COMMAND_RE = /^\s*(echo|printf|true|:)\b/

/**
 * Extracts the file views from a command made only of `cat` / `sed -n`
 * views (plus neutral echo/printf). Anything else — pipes, redirections,
 * other commands — means the output can't be trusted to be the file content.
 */
function extractFileViews(command: string): FileView[] {
  if (/[|<>]/.test(command)) return []
  let parts: string[]
  try {
    parts = splitCommand_DEPRECATED(command)
  } catch {
    return []
  }
  if (parts.length === 0) return []

  const views: FileView[] = []
  for (const part of parts) {
    const view = parseSedPrintView(part) ?? parseCatView(part)
    if (view) {
      views.push(view)
    } else if (parts.length > 1 && !NEUTRAL_COMMAND_RE.test(part)) {
      return []
    }
  }
  return views
}

/**
 * `sed -n 'X,Yp' file` / `sed -n 'Xp' file` → a line-range view.
 * Rejects in-place edits and -e/--expression scripts.
 */
function parseSedPrintView(command: string): FileView | null {
  let argv: string[]
  try {
    argv = parseCommandArgv(command)
  } catch {
    return null
  }
  if (argv[0] !== 'sed') return null

  let quiet = false
  let script: string | null = null
  let filePath: string | null = null
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('-')) {
      if (arg.startsWith('--')) {
        if (arg === '--in-place' || arg.startsWith('--in-place=')) return null
        if (arg === '--expression') return null
        if (arg === '--quiet' || arg === '--silent') quiet = true
      } else {
        if (arg.includes('i')) return null
        if (arg === '-e') return null
        if (arg.includes('n')) quiet = true
      }
      continue
    }
    if (script === null) script = arg
    else if (filePath === null) filePath = arg
    else return null
  }
  if (!quiet || script === null || filePath === null) return null

  const range = SED_RANGE_PRINT_RE.exec(script)
  if (range) {
    return {
      filePath,
      startLine: Number(range[1]),
      endLine: Number(range[2]),
    }
  }
  const single = SED_LINE_PRINT_RE.exec(script)
  if (single) {
    const line = Number(single[1])
    return { filePath, startLine: line, endLine: line }
  }
  return null
}

/** `cat file` / `cat -n file` → a whole-file view. */
function parseCatView(command: string): FileView | null {
  let argv: string[]
  try {
    argv = parseCommandArgv(command)
  } catch {
    return null
  }
  if (argv[0] !== 'cat') return null

  let filePath: string | null = null
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('-')) {
      if (arg !== '-n' && arg !== '--number') return null
      continue
    }
    if (filePath !== null) return null
    filePath = arg
  }
  if (filePath === null || filePath === '-') return null
  return { filePath, startLine: undefined, endLine: undefined }
}

/**
 * Records files viewed via `cat` / `sed -n` in readFileState, so Edit works on
 * them without a separate Read call. Existing entries (from Read) win.
 */
export async function recordFileViewsFromCommand(
  command: string,
  readFileState: FileStateCache,
  signal: AbortSignal,
): Promise<void> {
  const views = extractFileViews(command)
  if (views.length === 0) return

  const fs = getFsImplementation()
  await Promise.all(
    views.map(async view => {
      const fullPath = expandPath(view.filePath)
      if (readFileState.has(fullPath)) return
      try {
        const stats = await fs.stat(fullPath)
        if (stats.size > 10 * 1024 * 1024) return
        if (signal.aborted) return
        const fileContent = await fs.readFile(fullPath, { encoding: 'utf8' })
        let content: string
        let offset: number | undefined
        let limit: number | undefined
        if (view.startLine === undefined) {
          content = fileContent
        } else {
          const lines = fileContent.split('\n')
          const start = Math.max(1, view.startLine)
          const end = Math.max(start, view.endLine ?? start)
          if (start > lines.length) return
          content = lines.slice(start - 1, end).join('\n')
          offset = start
          limit = end - start + 1
        }
        readFileState.set(fullPath, {
          content,
          timestamp: Math.floor(stats.mtimeMs),
          offset,
          limit,
        })
      } catch {
        // Unreadable or vanished — leave readFileState untouched
      }
    }),
  )
}
