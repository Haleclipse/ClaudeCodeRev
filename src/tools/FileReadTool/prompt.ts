import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { isPDFSupported } from '../../utils/pdfUtils.js'
import { isRelativePathsEnabled } from '../../utils/relativePaths.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

/**
 * No-reread prompting (GrowthBook tengu_noreread_q7m_velvet): discourage
 * reading a file back after editing it, and word the unchanged-file stub as a
 * wasted call.
 */
export function isNoRereadEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_noreread_q7m_velvet', false)
}

/** Stub returned when a file is Read again without having changed. */
export function getFileUnchangedStub(): string {
  return isNoRereadEnabled()
    ? FILE_UNCHANGED_STUB_NOREREAD
    : FILE_UNCHANGED_STUB
}

/** Matches either wording of the unchanged-file stub. */
export function isFileUnchangedStub(text: string): boolean {
  return (
    text.startsWith(FILE_UNCHANGED_STUB) ||
    text.startsWith(FILE_UNCHANGED_STUB_NOREREAD)
  )
}

// Use a string constant for tool names to avoid circular dependencies
export const FILE_READ_TOOL_NAME = 'Read'

const NO_REREAD_INSTRUCTION =
  '\n- Do NOT re-read a file you just edited to verify — Edit/Write would have errored if the change failed, and the harness tracks file state for you.'

/** Appended to Edit / Write results when the no-reread gate is on. */
export const FILE_STATE_CURRENT_SUFFIX =
  ' (file state is current in your context — no need to Read it back)'

export const FILE_UNCHANGED_STUB =
  'File unchanged since last read. The content from the earlier Read tool_result in this conversation is still current — refer to that instead of re-reading.'

export const FILE_UNCHANGED_STUB_NOREREAD =
  'Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead.'

export const MAX_LINES_TO_READ = 2000

export const DESCRIPTION = 'Read a file from the local filesystem.'

export const LINE_FORMAT_INSTRUCTION =
  '- Results are returned using cat -n format, with line numbers starting at 1'

export const OFFSET_INSTRUCTION_DEFAULT =
  "- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters"

export const OFFSET_INSTRUCTION_TARGETED =
  '- When you already know which part of the file you need, only read that part. This can be important for larger files.'

/**
 * Renders the Read tool prompt template.  The caller (FileReadTool) supplies
 * the runtime-computed parts.
 */
export function renderPromptTemplate(
  lineFormat: string,
  maxSizeInstruction: string,
  offsetInstruction: string,
): string {
  return `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- ${
    isRelativePathsEnabled()
      ? 'The file_path parameter can be relative to cwd (preferred for brevity) or absolute'
      : 'The file_path parameter must be an absolute path, not a relative path'
  }
- By default, it reads up to ${MAX_LINES_TO_READ} lines starting from the beginning of the file${maxSizeInstruction}
${offsetInstruction}
${lineFormat}
- This tool allows Claude Code to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as Claude Code is a multimodal LLM.${
    isPDFSupported()
      ? '\n- This tool can read PDF files (.pdf). For large PDFs (more than 10 pages), you MUST provide the pages parameter to read specific page ranges (e.g., pages: "1-5"). Reading a large PDF without the pages parameter will fail. Maximum 20 pages per request.'
      : ''
  }
- This tool can read Jupyter notebooks (.ipynb files) and returns all cells with their outputs, combining code, text, and visualizations.
- This tool can only read files, not directories. To read a directory, use an ls command via the ${BASH_TOOL_NAME} tool.
- You will regularly be asked to read screenshots. If the user provides a path to a screenshot, ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.${
    isNoRereadEnabled() ? NO_REREAD_INSTRUCTION : ''
  }`
}
