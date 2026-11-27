import React, { useState } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js'
import { Byline } from '../design-system/Byline.js'
import { Dialog } from '../design-system/Dialog.js'
import TextInput from '../TextInput.js'

type Props = {
  initialPrompt?: string
  existingHookPresent?: boolean
  /** Called with the trimmed prompt; an empty string removes the hook. */
  onSubmit: (prompt: string) => void
  onCancel: () => void
}

type Focus = 'input' | 'delete'

export function StopHookDialog({
  initialPrompt = '',
  existingHookPresent = false,
  onSubmit,
  onCancel,
}: Props): React.ReactNode {
  const [value, setValue] = useState(initialPrompt)
  const [cursorOffset, setCursorOffset] = useState(initialPrompt.length)
  const [focus, setFocus] = useState<Focus>('input')
  const { columns } = useTerminalSize()

  const trimmed = value.trim()
  const isEmpty = trimmed.length === 0
  // Submitting an empty prompt deletes an existing hook
  const deleting = existingHookPresent && isEmpty

  function handleSubmit(): void {
    if (isEmpty && !deleting) return
    onSubmit(trimmed)
  }

  const handleDelete = (): void => {
    onSubmit('')
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!existingHookPresent) return
    if (e.key === 'tab') {
      e.preventDefault()
      setFocus(prev => (prev === 'input' ? 'delete' : 'input'))
      return
    }
    if (focus === 'delete' && e.key === 'return') {
      e.preventDefault()
      handleDelete()
    }
  }

  useKeybinding('confirm:no', onCancel, { context: 'Settings', isActive: true })

  function renderInputGuide(exitState: {
    pending: boolean
    keyName: string
  }): React.ReactNode {
    if (exitState.pending) {
      return <Text>Press {exitState.keyName} again to exit</Text>
    }
    return (
      <Byline>
        <Text>
          Enter to {focus === 'delete' ? 'delete hook' : deleting ? 'delete hook' : existingHookPresent ? 'update hook' : 'add hook'}
        </Text>
        {existingHookPresent ? <Text>Tab to switch focus</Text> : null}
        <ConfigurableShortcutHint
          action="confirm:no"
          context="Settings"
          fallback="Esc"
          description="cancel"
        />
      </Byline>
    )
  }

  return (
    <Box flexDirection="column" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <Dialog
        title="Set Stop hook (this session only)"
        subtitle="Enter a stopping condition. A good condition asks whether something has been done."
        color="permission"
        onCancel={onCancel}
        inputGuide={renderInputGuide}
        isCancelActive={false}
      >
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1} marginTop={1}>
            <Text>{'>'}</Text>
            <TextInput
              value={value}
              onChange={setValue}
              onSubmit={handleSubmit}
              focus={focus === 'input'}
              showCursor={focus === 'input'}
              multiline={false}
              columns={columns - 4}
              cursorOffset={cursorOffset}
              onChangeCursorOffset={setCursorOffset}
              placeholder="e.g. Has Claude completed all requested tasks?"
              disableEscapeDoublePress
            />
          </Box>
          {existingHookPresent && (
            <Box marginTop={1}>
              <Text
                color={focus === 'delete' ? 'error' : undefined}
                dimColor={focus !== 'delete'}
              >
                {focus === 'delete' ? '› ' : '  '}Delete this hook
              </Text>
            </Box>
          )}
        </Box>
      </Dialog>
    </Box>
  )
}
