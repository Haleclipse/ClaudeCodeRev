import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import {
  isAutoCompactEnabled,
  parseAutoCompactWindow,
  resolveAutoCompactWindow,
} from '../../services/compact/autoCompact.js'
import type {
  LocalCommandCall,
  LocalJSXCommandContext,
} from '../../types/command.js'
import { formatTokens } from '../../utils/format.js'
import {
  getInitialSettings,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'

/** `/autocompact` with no argument: current window, where it comes from, and what it means. */
function describeAutoCompactWindow(
  model: string,
  autoCompactWindow: number | undefined,
): string {
  const { window, configured, source } = resolveAutoCompactWindow(
    model,
    autoCompactWindow,
  )
  const sourceLabel =
    source === 'env'
      ? ' (from CLAUDE_CODE_AUTO_COMPACT_WINDOW)'
      : source === 'settings'
        ? ' (from settings)'
        : ' (model default)'
  const cappedNote =
    configured > window ? ` · capped to ${formatTokens(window)} by model` : ''
  const lines = [
    `Auto-compact window: ${formatTokens(configured)} tokens${sourceLabel}${cappedNote}`,
  ]
  if (!isAutoCompactEnabled()) {
    lines.push('Auto-compact is currently disabled (see /config)')
  }
  lines.push(
    "Auto-compact summarizes the conversation when context usage approaches this limit. The actual threshold is the minimum of this setting and your model's context window.",
  )
  return lines.join('\n')
}

/**
 * Applies a `/autocompact <arg>` value: a window size ("500k", "200000",
 * "200") or reset/unset/default. Writes userSettings.autoCompactWindow,
 * mirrors it into AppState, and returns the message to show. Refuses while
 * CLAUDE_CODE_AUTO_COMPACT_WINDOW is set, since that would win anyway.
 */
export function applyAutoCompactWindow(
  arg: string,
  context: LocalJSXCommandContext,
): string {
  if (process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) {
    return 'CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset it to change this setting.'
  }
  const model = context.options.mainLoopModel
  const normalized = arg.trim().toLowerCase()
  const isReset =
    normalized === 'reset' || normalized === 'unset' || normalized === 'default'
  const tokens = isReset ? undefined : parseAutoCompactWindow(normalized)
  if (!isReset && tokens === undefined) {
    return `Invalid argument: ${arg}. Expected 100k–1M tokens (e.g. 500k, 200000, or 200 as shorthand) or 'reset'`
  }

  updateSettingsForSource('userSettings', { autoCompactWindow: tokens })
  context.setAppState(prev =>
    prev.autoCompactWindow === tokens
      ? prev
      : { ...prev, autoCompactWindow: tokens },
  )
  logEvent('tengu_autocompact_command', {
    action: (isReset
      ? 'reset'
      : 'set') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    ...(tokens !== undefined && { tokens }),
  })

  // A higher-priority settings source (or the env var) may still override
  // what we just wrote to userSettings
  const effectiveSetting = getInitialSettings().autoCompactWindow
  const { window, source } = resolveAutoCompactWindow(model, effectiveSetting)
  const overridden = source === 'env' || effectiveSetting !== tokens
  if (isReset) {
    return overridden
      ? `Auto-compact window reset in settings, but a higher-priority override is active (${formatTokens(window)} tokens)`
      : 'Auto-compact window reset to model default'
  }
  let note = ''
  if (overridden) {
    note = `, but a higher-priority override is active (${formatTokens(window)} tokens)`
  } else if (window < tokens!) {
    note = ` (capped to model limit of ${formatTokens(window)})`
  }
  return `Auto-compact window set to ${formatTokens(tokens!)} tokens${note}`
}

export const call: LocalCommandCall = async (args, context) => {
  const trimmed = args.trim()
  if (!trimmed) {
    return {
      type: 'text',
      value: describeAutoCompactWindow(
        context.options.mainLoopModel,
        context.getAppState().autoCompactWindow,
      ),
    }
  }
  return { type: 'text', value: applyAutoCompactWindow(trimmed, context) }
}
