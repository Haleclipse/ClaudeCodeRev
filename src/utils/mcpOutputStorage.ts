import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import type { MCPResultType } from '../services/mcp/client.js'
import { AGENT_TOOL_NAME } from '../tools/AgentTool/constants.js'
import { toError } from './errors.js'
import { formatFileSize } from './format.js'
import { logError } from './log.js'
import { textBefore } from './stringUtils.js'
import { ensureToolResultsDir, getToolResultsDir } from './toolResultStorage.js'

/**
 * Generates a format description string based on the MCP result type and schema.
 */
export function getFormatDescription(
  type: MCPResultType,
  schema?: unknown,
): string {
  switch (type) {
    case 'toolResult':
      return 'Plain text'
    case 'structuredContent':
      return schema ? `JSON with schema: ${schema}` : 'JSON'
    case 'contentArray':
      return schema ? `JSON array with schema: ${schema}` : 'JSON array'
  }
}

/**
 * Generates instruction text for Claude to read from a saved output file.
 *
 * @param rawOutputPath - Path to the saved output file
 * @param contentLength - Length of the content in characters
 * @param formatDescription - Description of the content format
 * @param maxReadLength - Optional max chars for Read tool (for Bash output context)
 * @returns Instruction text to include in the tool result
 */
export function getLargeOutputInstructions(
  rawOutputPath: string,
  contentLength: number,
  formatDescription: string,
  maxReadLength?: number,
): string {
  const header =
    `Error: result (${contentLength.toLocaleString()} characters) exceeds maximum allowed tokens. Output has been saved to ${rawOutputPath}.\n` +
    `Format: ${formatDescription}\n`

  // Subagent prompt: point the model at an Agent subagent for full reads so
  // the whole output never enters the main context. MCP_TRUNCATION_PROMPT_OVERRIDE
  // (subagent | legacy) forces either variant.
  const override = process.env.MCP_TRUNCATION_PROMPT_OVERRIDE
  const useSubagentPrompt =
    override === 'subagent'
      ? true
      : override === 'legacy'
        ? false
        : getFeatureValue_CACHED_MAY_BE_STALE('tengu_mcp_subagent_prompt', false)
  if (!useSubagentPrompt) {
    return (
      header +
      `Use offset and limit parameters to read specific portions of the file, search within it for specific content, and jq to make structured queries.\n` +
      `REQUIREMENTS FOR SUMMARIZATION/ANALYSIS/REVIEW:\n` +
      getFullReadRequirements(rawOutputPath, maxReadLength)
    )
  }

  return (
    header +
    `- For targeted queries (find a row, filter by field): use jq or grep on the file directly.\n` +
    `- For analysis or summarization that requires reading the full content: use the ${AGENT_TOOL_NAME} tool to process the file in an isolated context so the full output does not enter your main context. Be explicit about what the subagent must return — e.g. "Read ${rawOutputPath} in sequential chunks using offset/limit until you have read 100% of it, then summarize it and quote any key findings, decisions, or action items verbatim" — a vague "summarize this" may lose the detail you actually need. Require it to read the entire file in chunks before answering.\n`
  )
}

/**
 * The "read 100% of the file in chunks, then say what you read" requirements
 * of the legacy large-output prompt.
 *
 * @param maxReadLength - Optional max chars for Read tool (for Bash output context)
 */
function getFullReadRequirements(
  rawOutputPath: string,
  maxReadLength?: number,
): string {
  const truncationWarning = maxReadLength
    ? `- If you receive truncation warnings when reading the file ("[N lines truncated]"), reduce the chunk size until you have read 100% of the content without truncation ***DO NOT PROCEED UNTIL YOU HAVE DONE THIS***. Bash output is limited to ${maxReadLength.toLocaleString()} chars.\n`
    : `- If you receive truncation warnings when reading the file, reduce the chunk size until you have read 100% of the content without truncation.\n`

  return (
    `- You MUST read the content from the file at ${rawOutputPath} in sequential chunks until 100% of the content has been read.\n` +
    truncationWarning +
    `- Before producing ANY summary or analysis, you MUST explicitly describe what portion of the content you have read. ***If you did not read the entire content, you MUST explicitly state this.***\n`
  )
}

/**
 * Map a mime type to a file extension. Conservative: known types get their
 * proper extension; unknown types get 'bin'. The extension matters because
 * the Read tool dispatches on it (PDFs, images, etc. need the right ext).
 */
export function extensionForMimeType(mimeType: string | undefined): string {
  if (!mimeType) return 'bin'
  // Strip any charset/boundary parameter
  const mt = textBefore(mimeType, ';').trim().toLowerCase()
  switch (mt) {
    case 'application/pdf':
      return 'pdf'
    case 'application/json':
      return 'json'
    case 'text/csv':
      return 'csv'
    case 'text/plain':
      return 'txt'
    case 'text/html':
      return 'html'
    case 'text/markdown':
      return 'md'
    case 'application/zip':
      return 'zip'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx'
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx'
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'pptx'
    case 'application/msword':
      return 'doc'
    case 'application/vnd.ms-excel':
      return 'xls'
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/wav':
      return 'wav'
    case 'audio/ogg':
      return 'ogg'
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'bin'
  }
}

/**
 * Heuristic for whether a content-type header indicates binary content that
 * should be saved to disk rather than put into the model context.
 * Text-ish types (text/*, json, xml, form data) are treated as non-binary.
 */
export function isBinaryContentType(contentType: string): boolean {
  if (!contentType) return false
  const mt = textBefore(contentType, ';').trim().toLowerCase()
  if (mt.startsWith('text/')) return false
  // Structured text formats delivered with an application/ type. Use suffix
  // or exact match rather than substring so 'openxmlformats' (docx/xlsx) stays binary.
  if (mt.endsWith('+json') || mt === 'application/json') return false
  if (mt.endsWith('+xml') || mt === 'application/xml') return false
  if (mt.startsWith('application/javascript')) return false
  if (mt === 'application/x-www-form-urlencoded') return false
  return true
}

export type PersistBinaryResult =
  | { filepath: string; size: number; ext: string }
  | { error: string }

/**
 * Write raw binary bytes to the tool-results directory with a mime-derived
 * extension. Unlike persistToolResult (which stringifies), this writes the
 * bytes as-is so the resulting file can be opened with native tools (Read
 * for PDFs, pandas for xlsx, etc.).
 */
export async function persistBinaryContent(
  bytes: Buffer,
  mimeType: string | undefined,
  persistId: string,
): Promise<PersistBinaryResult> {
  await ensureToolResultsDir()
  const ext = extensionForMimeType(mimeType)
  const filepath = join(getToolResultsDir(), `${persistId}.${ext}`)

  try {
    await writeFile(filepath, bytes)
  } catch (error) {
    const err = toError(error)
    logError(err)
    return { error: err.message }
  }

  // mime type and extension are safe fixed-vocabulary strings (not paths/code)
  logEvent('tengu_binary_content_persisted', {
    mimeType: (mimeType ??
      'unknown') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    sizeBytes: bytes.length,
    ext: ext as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })

  return { filepath, size: bytes.length, ext }
}

/**
 * Build a short message telling Claude where binary content was saved.
 * Just states the path — no prescriptive hint, since what the model can
 * actually do with the file depends on provider/tooling.
 */
export function getBinaryBlobSavedMessage(
  filepath: string,
  mimeType: string | undefined,
  size: number,
  sourceDescription: string,
): string {
  const mt = mimeType || 'unknown type'
  return `${sourceDescription}Binary content (${mt}, ${formatFileSize(size)}) saved to ${filepath}`
}
