// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .claude/ folder
export const CLAUDE_FOLDER_PERMISSION_PATTERN = '/.claude/**'

// Permission pattern for granting session-level access to the global ~/.claude/ folder
export const GLOBAL_CLAUDE_FOLDER_PERMISSION_PATTERN = '~/.claude/**'

// Edit/Write call-time staleness errors. Kept separate so the model can tell
// "never read" from "changed since read" (the latter is usually a formatter or
// linter run through Bash rewriting the file).
export const FILE_NOT_READ_ERROR =
  'File has not been read yet. Read it first before writing to it.'

export const FILE_MODIFIED_SINCE_READ_ERROR =
  'File content has changed since it was last read. This commonly happens when a linter or formatter run via Bash rewrites the file. Call Read on this file to refresh, then retry the edit.'
