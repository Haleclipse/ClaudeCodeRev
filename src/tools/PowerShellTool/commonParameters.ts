/**
 * PowerShell Common Parameters (available on all cmdlets via [CmdletBinding()]).
 * Source: about_CommonParameters (PowerShell docs) + Get-Command output.
 *
 * Shared between pathValidation.ts (merges into per-cmdlet known-param sets)
 * and readOnlyValidation.ts (merges into safeFlags check). Split out to break
 * what would otherwise be an import cycle between those two files.
 *
 * Stored lowercase with leading dash — callers `.toLowerCase()` their input.
 */

export const COMMON_SWITCHES = ['-verbose', '-debug']

export const COMMON_VALUE_PARAMS = [
  '-erroraction',
  '-warningaction',
  '-informationaction',
  '-progressaction',
  '-errorvariable',
  '-warningvariable',
  '-informationvariable',
  '-outvariable',
  '-outbuffer',
  '-pipelinevariable',
  '-ea',
  '-wa',
  '-infa',
  '-proga',
]

export const COMMON_PARAMETERS: ReadonlySet<string> = new Set([
  ...COMMON_SWITCHES,
  ...COMMON_VALUE_PARAMS,
])

/**
 * Action-preference common parameters. A value like `-ErrorAction Break`
 * (or Inquire / Suspend) drops into the debugger or prompts and hangs a
 * non-interactive run, so only the values in SAFE_ACTION_PREFERENCE_VALUES
 * keep a command read-only.
 */
const ACTION_PREFERENCE_PARAMS = [
  '-erroraction',
  '-warningaction',
  '-informationaction',
  '-progressaction',
]

const ACTION_PREFERENCE_ALIASES = ['-ea', '-wa', '-infa', '-proga']

/**
 * Whether a lowercased `-name` (no `:value`) is an action-preference
 * parameter: an alias, or any prefix of at least two characters — PowerShell
 * accepts unambiguous parameter-name abbreviations such as `-ErrorA`.
 */
export function isActionPreferenceParameter(name: string): boolean {
  if (name.length < 2) return false
  return (
    ACTION_PREFERENCE_ALIASES.includes(name) ||
    ACTION_PREFERENCE_PARAMS.some(p => p.startsWith(name))
  )
}

export const ACTION_PREFERENCE_PARAMETERS: ReadonlySet<string> = new Set([
  ...ACTION_PREFERENCE_PARAMS,
  ...ACTION_PREFERENCE_ALIASES,
])

export const SAFE_ACTION_PREFERENCE_VALUES: ReadonlySet<string> = new Set([
  'silentlycontinue',
  '0',
  'stop',
  '1',
  'continue',
  '2',
  'ignore',
  '4',
])
