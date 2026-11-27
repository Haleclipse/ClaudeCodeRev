import React from 'react'
import Text from '../../ink/components/Text.js'
import { type ChordFormat, formatChords } from '../../keybindings/chordFormat.js'
import { parseChord } from '../../keybindings/parser.js'

type Props = {
  /**
   * The key or chord to display, in keybinding syntax (e.g., "ctrl+o",
   * "enter", "ctrl+x ctrl+k"). An array lists alternatives ("up"/"down"
   * render as "↑/↓").
   */
  chord: string | string[]
  /** The action the key performs (e.g., "expand", "select", "navigate") */
  action: string
  /** How to render the chord (style preset plus overrides). Default style: Title-case keys */
  format?: ChordFormat
  /** Whether to wrap the hint in parentheses. Default: false */
  parens?: boolean
  /** Whether to render the shortcut in bold. Default: false */
  bold?: boolean
}

/**
 * Renders a keyboard shortcut hint like "ctrl+o to expand" or "(tab to toggle)"
 *
 * Wrap in <Text dimColor> for the common dim styling.
 *
 * @example
 * // Simple hint wrapped in dim Text
 * <Text dimColor><KeyboardShortcutHint chord="escape" action="cancel" /></Text>
 *
 * // With parentheses: "(ctrl+o to expand)"
 * <Text dimColor><KeyboardShortcutHint chord="ctrl+o" action="expand" parens format={{ keyCase: 'lower' }} /></Text>
 *
 * // With bold shortcut: "Enter to confirm" (Enter is bold)
 * <Text dimColor><KeyboardShortcutHint chord="enter" action="confirm" bold /></Text>
 *
 * // Multiple hints with middot separator - use Byline
 * <Text dimColor>
 *   <Byline>
 *     <KeyboardShortcutHint chord="enter" action="confirm" />
 *     <KeyboardShortcutHint chord="escape" action="cancel" />
 *   </Byline>
 * </Text>
 */
export function KeyboardShortcutHint({
  chord,
  action,
  format,
  parens = false,
  bold = false,
}: Props): React.ReactNode {
  const shortcut = formatChords(
    (typeof chord === 'string' ? [chord] : chord).map(parseChord),
    format,
  )
  if (!shortcut) return null
  const shortcutText = bold ? <Text bold>{shortcut}</Text> : shortcut

  if (parens) {
    return (
      <Text>
        ({shortcutText} to {action})
      </Text>
    )
  }
  return (
    <Text>
      {shortcutText} to {action}
    </Text>
  )
}
