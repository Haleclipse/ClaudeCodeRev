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

export function SessionTokenStep(): ReactNode {
  const { goBack, goNext, updateWizardData, wizardData } =
    useWizard<BedrockWizardData>()
  const [value, setValue] = useState(
    wizardData.sessionToken ?? '',
  )
  const [cursorOffset, setCursorOffset] = useState(value.length)

  useKeybinding('confirm:no', goBack, { context: 'Settings' })

  const handleSubmit = (): void => {
    updateWizardData({ sessionToken: value.trim() || undefined })
    goNext()
  }

  return (
    <WizardDialogLayout
      subtitle="AWS session token (optional)"
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
        <Text dimColor>
          Only needed for temporary credentials from STS. Leave empty for
          long-lived keys.
        </Text>
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
      </Box>
    </WizardDialogLayout>
  )
}
