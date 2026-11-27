import chalk from 'chalk'
import React, { useContext } from 'react'
import { Text } from '../ink.js'
import { getShortcutDisplay } from '../keybindings/shortcutFormat.js'
import { useShortcutChord } from '../keybindings/useShortcutChord.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'
import { InVirtualListContext } from './messageActions.js'

// Context to track if we're inside a sub agent
// Similar to MessageResponseContext, this helps us avoid showing
// too many "(ctrl+o to expand)" hints in sub agent output
const SubAgentContext = React.createContext(false)

export function SubAgentProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  return (
    <SubAgentContext.Provider value={true}>{children}</SubAgentContext.Provider>
  )
}

export function CtrlOToExpand(): React.ReactNode {
  const isInSubAgent = useContext(SubAgentContext)
  const inVirtualList = useContext(InVirtualListContext)
  const expandShortcut = useShortcutChord(
    'app:toggleTranscript',
    'Global',
    'ctrl+o',
  )
  if (isInSubAgent || inVirtualList) {
    return null
  }
  return (
    <Text dimColor>
      <KeyboardShortcutHint
        chord={expandShortcut}
        action="expand"
        parens
        format={{ keyCase: 'lower' }}
      />
    </Text>
  )
}

export function ctrlOToExpand(): string {
  const shortcut = getShortcutDisplay(
    'app:toggleTranscript',
    'Global',
    'ctrl+o',
  )
  return chalk.dim(`(${shortcut} to expand)`)
}
