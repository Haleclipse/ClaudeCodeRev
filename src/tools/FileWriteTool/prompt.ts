import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

export const FILE_WRITE_TOOL_NAME = 'Write'
export const DESCRIPTION = 'Write a file to the local filesystem.'

function getPreReadInstruction(): string {
  return `\n- If this is an existing file, you MUST use the ${FILE_READ_TOOL_NAME} tool first to read the file's contents. This tool will fail if you did not read the file first.`
}

export function getWriteToolDescription(): string {
  const appendEnabled = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_maple_forge_w8k',
    false,
  )
  const appendInstruction = appendEnabled
    ? "\n- To add content to the end of an existing file, set mode:'append' and pass only the new content. Do NOT re-send the existing file contents."
    : ''
  const scope = appendEnabled
    ? "Only use this tool to create new files, for complete rewrites, or to append with mode:'append'."
    : 'Only use this tool to create new files or for complete rewrites.'
  return `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.${getPreReadInstruction()}${appendInstruction}
- Prefer the Edit tool for modifying existing files \u2014 it only sends the diff. ${scope}
- NEVER create documentation files (*.md) or README files unless explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`
}
