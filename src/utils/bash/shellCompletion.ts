import type { SuggestionItem } from 'src/components/PromptInput/PromptInputFooterSuggestions.js'
import { logForDebugging } from '../debug.js'
import { getShellType } from '../localInstaller.js'
import * as Shell from '../Shell.js'

// Constants
const MAX_SHELL_COMPLETIONS = 15
const SHELL_COMPLETION_TIMEOUT_MS = 1000

export type ShellCompletionType = 'command' | 'variable' | 'file'

type InputContext = {
  prefix: string
  completionType: ShellCompletionType
}

/**
 * Single-quote the completion prefix for compgen. Always quoting (even
 * plain words) keeps the generated command a fixed shape.
 */
function quote(args: [string]): string {
  return "'" + args[0].replaceAll("'", `'"'"'`) + "'"
}

/**
 * Determine completion type based solely on prefix characteristics
 */
function getCompletionTypeFromPrefix(prefix: string): ShellCompletionType {
  if (prefix.startsWith('$')) {
    return 'variable'
  }
  if (
    prefix.includes('/') ||
    prefix.startsWith('~') ||
    prefix.startsWith('.')
  ) {
    return 'file'
  }
  return 'command'
}

/**
 * Parse input to extract completion context
 */
function parseInputContext(input: string, cursorOffset: number): InputContext {
  const beforeCursor = input.slice(0, cursorOffset)

  // Check if it's a variable prefix
  const varMatch = beforeCursor.match(/\$[a-zA-Z_][a-zA-Z0-9_]*$/)
  if (varMatch) {
    return { prefix: varMatch[0], completionType: 'variable' }
  }

  // Simple whitespace split: the last word is the prefix being completed
  const tokens = beforeCursor.split(/\s+/)
  const prefix = tokens.at(-1) || ''
  const isFirstToken = tokens.length === 1 && !beforeCursor.includes(' ')
  const baseType = getCompletionTypeFromPrefix(prefix)

  // A clear file/variable prefix wins; otherwise the first word is a
  // command and later words are file arguments.
  return {
    prefix,
    completionType:
      baseType !== 'command' ? baseType : isFirstToken ? 'command' : 'file',
  }
}

/**
 * Generate bash completion command using compgen
 */
function getBashCompletionCommand(
  prefix: string,
  completionType: ShellCompletionType,
): string {
  if (completionType === 'variable') {
    // Variable completion - remove $ prefix
    const varName = prefix.slice(1)
    return `compgen -v ${quote([varName])} 2>/dev/null`
  } else if (completionType === 'file') {
    // File completion with trailing slash for directories and trailing space for files
    // Use 'while read' to prevent command injection from filenames containing newlines
    return `compgen -f ${quote([prefix])} 2>/dev/null | head -${MAX_SHELL_COMPLETIONS} | while IFS= read -r f; do [ -d "$f" ] && echo "$f/" || echo "$f "; done`
  } else {
    // Command completion
    return `compgen -c ${quote([prefix])} 2>/dev/null`
  }
}

/**
 * Generate zsh completion command using native zsh commands
 */
function getZshCompletionCommand(
  prefix: string,
  completionType: ShellCompletionType,
): string {
  if (completionType === 'variable') {
    // Variable completion - use zsh pattern matching for safe filtering
    const varName = prefix.slice(1)
    return `print -rl -- \${(k)parameters[(I)${quote([varName])}*]} 2>/dev/null`
  } else if (completionType === 'file') {
    // File completion with trailing slash for directories and trailing space for files
    // Note: zsh glob expansion is safe from command injection (unlike bash for-in loops)
    return `for f in ${quote([prefix])}*(N[1,${MAX_SHELL_COMPLETIONS}]); do [[ -d "$f" ]] && echo "$f/" || echo "$f "; done`
  } else {
    // Command completion - use zsh pattern matching for safe filtering
    return `print -rl -- \${(k)commands[(I)${quote([prefix])}*]} 2>/dev/null`
  }
}

/**
 * Get completions for the given shell type
 */
async function getCompletionsForShell(
  shellType: 'bash' | 'zsh',
  prefix: string,
  completionType: ShellCompletionType,
  abortSignal: AbortSignal,
): Promise<SuggestionItem[]> {
  let command: string

  if (shellType === 'bash') {
    command = getBashCompletionCommand(prefix, completionType)
  } else if (shellType === 'zsh') {
    command = getZshCompletionCommand(prefix, completionType)
  } else {
    // Unsupported shell type
    return []
  }

  const shellCommand = await Shell.exec(command, abortSignal, 'bash', {
    timeout: SHELL_COMPLETION_TIMEOUT_MS,
  })
  const result = await shellCommand.result
  return result.stdout
    .split('\n')
    .filter((line: string) => line.trim())
    .slice(0, MAX_SHELL_COMPLETIONS)
    .map((text: string) => ({
      id: text,
      displayText: text,
      description: undefined,
      metadata: { completionType },
    }))
}

/**
 * Get shell completions for the given input
 * Supports bash and zsh shells (matches Shell.ts execution support)
 */
export async function getShellCompletions(
  input: string,
  cursorOffset: number,
  abortSignal: AbortSignal,
): Promise<SuggestionItem[]> {
  const shellType = getShellType()

  // Only support bash/zsh (matches Shell.ts execution support)
  if (shellType !== 'bash' && shellType !== 'zsh') {
    return []
  }

  try {
    const { prefix, completionType } = parseInputContext(input, cursorOffset)

    if (!prefix) {
      return []
    }

    const completions = await getCompletionsForShell(
      shellType,
      prefix,
      completionType,
      abortSignal,
    )

    // Add inputSnapshot to all suggestions so we can detect when input changes
    return completions.map(suggestion => ({
      ...suggestion,
      metadata: {
        ...(suggestion.metadata as { completionType: ShellCompletionType }),
        inputSnapshot: input,
      },
    }))
  } catch (error) {
    logForDebugging(`Shell completion failed: ${error}`)
    return [] // Silent fail
  }
}
