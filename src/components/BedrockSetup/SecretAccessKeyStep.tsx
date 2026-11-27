import React, { type ReactNode, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js'
import { Byline } from '../design-system/Byline.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import TextInput from '../TextInput.js'
import { useWizard } from '../wizard/index.js'
import { WizardDialogLayout } from '../wizard/WizardDialogLayout.js'
import type { BedrockWizardData } from './steps.js'

export function SecretAccessKeyStep(): ReactNode {
  const { goBack, goNext, updateWizardData, wizardData } =
    useWizard<BedrockWizardData>()
  const [value, setValue] = useState(
    wizardData.secretAccessKey ?? '',
  )
  const [cursorOffset, setCursorOffset] = useState(value.length)
  const [error, setError] = useState<string | null>(null)

  useKeybinding('confirm:no', goBack, { context: 'Settings' })

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Secret access key is required')
      return
    }
    setError(null)
    updateWizardData({ secretAccessKey: trimmed })
    goNext()
  }

  return (
    <WizardDialogLayout
      subtitle="AWS secret access key"
      footerText={
        <Byline>
          <KeyboardShortcutHint chord="enter" action="continue" />
          <ConfigurableShortcutHint
            action="confirm:no"
            context="Settings"
            fallback="Esc"
            description="go back"
          />
        </Byline>
      }
    >
      <Box flexDirection="column">
        <Box marginTop={1}>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            mask="*"
            columns={60}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            focus
            showCursor
          />
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="error">{error}</Text>
          </Box>
        )}
      </Box>
    </WizardDialogLayout>
  )
}
