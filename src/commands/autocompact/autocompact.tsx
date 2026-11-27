import * as React from 'react'
import { useState } from 'react'
import { Dialog } from '../../components/design-system/Dialog.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { Box, Text } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import {
  isAutoCompactEnabled,
  resolveAutoCompactWindow,
} from '../../services/compact/autoCompact.js'
import { useAppState } from '../../state/AppState.js'
import type {
  LocalJSXCommandCall,
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { formatTokens } from '../../utils/format.js'
import { applyAutoCompactWindow } from './autocompact-noninteractive.js'

const LONG_CONTEXT_URL = 'https://claude.com/blog/1m-context-ga'

// The dialog steps through MIN_WINDOW..MAX_WINDOW in STEP increments, with
// MODEL_DEFAULT (no setting) just outside both ends of the range.
const STEP = 100_000
const MIN_WINDOW = 100_000
const MAX_WINDOW = 1_000_000
const MODEL_DEFAULT = 0

type Props = {
  onDone: LocalJSXCommandOnDone
  context: LocalJSXCommandContext
}

function AutoCompactDialog({ onDone, context }: Props): React.ReactNode {
  const autoCompactWindow = useAppState(s => s.autoCompactWindow)
  const mainLoopModel = useMainLoopModel()
  const { window, configured, source } = resolveAutoCompactWindow(
    mainLoopModel,
    autoCompactWindow,
  )
  const autoCompactEnabled = isAutoCompactEnabled()
  const isCapped = configured > window
  const isEnvOverride = source === 'env'
  const sourceLabel =
    source === 'env'
      ? 'from CLAUDE_CODE_AUTO_COMPACT_WINDOW'
      : source === 'settings'
        ? 'from settings'
        : source === 'experiment'
          ? 'from default'
          : 'model default'
  const initialValue =
    source === 'model' || source === 'experiment'
      ? MODEL_DEFAULT
      : Math.min(
          MAX_WINDOW,
          Math.max(MIN_WINDOW, Math.round(configured / STEP) * STEP),
        )
  const [value, setValue] = useState(initialValue)
  const [changed, setChanged] = useState(false)

  function step(direction: number) {
    if (isEnvOverride) return
    setChanged(true)
    setValue(prev => {
      if (prev === MODEL_DEFAULT) return direction > 0 ? MIN_WINDOW : MAX_WINDOW
      const next = prev + direction * STEP
      if (next < MIN_WINDOW) return MODEL_DEFAULT
      if (next > MAX_WINDOW) return MODEL_DEFAULT
      return next
    })
  }

  const cappedNote = isCapped
    ? ` · capped to ${formatTokens(window)} by model`
    : ''
  const currentLabel = `${formatTokens(configured)} tokens (${sourceLabel})${cappedNote}`

  function apply() {
    if (!changed) {
      onDone(`Auto-compact window unchanged: ${currentLabel}`)
      return
    }
    const arg = value === MODEL_DEFAULT ? 'reset' : String(value)
    onDone(applyAutoCompactWindow(arg, context))
  }

  useKeybindings(
    {
      'select:previous': () => step(1),
      'select:next': () => step(-1),
      'select:accept': apply,
    },
    { context: 'Select' },
  )
  useKeybindings(
    {
      'tabs:next': () => step(1),
      'tabs:previous': () => step(-1),
    },
    { context: 'Tabs' },
  )

  const displayValue =
    value === MODEL_DEFAULT ? 'Model default' : `${formatTokens(value)} tokens`
  const subtitle = `Current setting: ${currentLabel}`

  return (
    <Dialog
      title="Auto-compact"
      subtitle={subtitle}
      onCancel={() => onDone(`Auto-compact window unchanged: ${currentLabel}`)}
      inputGuide={() => (
        <Text dimColor>↑/↓ to change · Enter to apply · Esc to cancel</Text>
      )}
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          This command configures when auto-compaction happens. The actual
          threshold is the minimum of this setting and your model's context
          window.
        </Text>
        {!autoCompactEnabled && (
          <Text color="warning">
            Auto-compact is currently disabled (see /config)
          </Text>
        )}
        {isEnvOverride ? (
          <Text color="warning">
            CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset
            it to change this setting here.
          </Text>
        ) : (
          <Box>
            <Text>Select auto-compact window: </Text>
            <Text bold color="suggestion">
              {displayValue}
            </Text>
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Long context that holds up</Text>
          <Text>
            Both Opus 4.6 and Sonnet 4.6 achieve state-of-the-art scores on
            long-context retrieval benchmarks at 1M tokens — Opus 4.6 scores
            78.3% on MRCR v2, the highest among frontier models at that length.
            Opus 4.6 includes 1M context at standard pricing; Sonnet 4.6 1M is
            available with overages.
          </Text>
          <Text dimColor>Learn more: {LONG_CONTEXT_URL}</Text>
        </Box>
      </Box>
    </Dialog>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const trimmed = args?.trim() || ''
  if (trimmed) {
    const result = applyAutoCompactWindow(trimmed, context)
    onDone(result)
    return null
  }
  logEvent('tengu_autocompact_dialog_opened', {
    source:
      'dialog' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
  return <AutoCompactDialog onDone={onDone} context={context} />
}
