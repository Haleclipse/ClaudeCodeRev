import * as React from 'react'
import type {
  KeybindingAction,
  KeybindingContextName,
} from '../keybindings/types.js'
import { useShortcutChord } from '../keybindings/useShortcutChord.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'

type Props = {
  /** The keybinding action (e.g., 'app:toggleTranscript') */
  action: KeybindingAction
  /** The keybinding context (e.g., 'Global') */
  context: KeybindingContextName
  /** Default shortcut if keybinding not configured */
  fallback: string
  /** The action description text (e.g., 'expand') */
  description: string
  /** Whether to wrap in parentheses */
  parens?: boolean
  /** Whether to show in bold */
  bold?: boolean
}

/**
 * KeyboardShortcutHint that displays the user-configured shortcut.
 * Falls back to default if keybinding context is not available.
 *
 * @example
 * <ConfigurableShortcutHint
 *   action="app:toggleTranscript"
 *   context="Global"
 *   fallback="ctrl+o"
 *   description="expand"
 * />
 */
export function ConfigurableShortcutHint({
  action,
  context,
  fallback,
  description,
  parens,
  bold,
}: Props): React.ReactNode {
  const chord = useShortcutChord(action, context, fallback)
  return (
    <KeyboardShortcutHint
      chord={chord}
      action={description}
      parens={parens}
      bold={bold}
    />
  )
}
