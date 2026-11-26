import { getSettings_DEPRECATED, getSettingsForSource } from './settings/settings.js'

// Same block / inline syntax promptShellExecution executes, without the
// capture groups.
const BLOCK_PATTERN = /```!\s*\n?[\s\S]*?\n?```/g
const INLINE_PATTERN = /(?<=^|\s)!`[^`]+`/gm

export const SHELL_EXECUTION_DISABLED_PLACEHOLDER =
  '[shell command execution disabled by policy]'

/**
 * disableSkillShellExecution: managed (policySettings) value first, then the
 * merged settings.
 */
export function isSkillShellExecutionDisabled(): boolean {
  if (getSettingsForSource('policySettings')?.disableSkillShellExecution === true) {
    return true
  }
  return getSettings_DEPRECATED().disableSkillShellExecution === true
}

/** Replace ```! blocks and !`…` inline commands with the placeholder. */
export function replaceShellCommandsWithPlaceholder(content: string): string {
  let result = content.replace(BLOCK_PATTERN, SHELL_EXECUTION_DISABLED_PLACEHOLDER)
  if (result.includes('!`')) {
    result = result.replace(INLINE_PATTERN, SHELL_EXECUTION_DISABLED_PLACEHOLDER)
  }
  return result
}
