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

export function RegionStep(): ReactNode {
  const { goBack, goNext, updateWizardData, wizardData } =
    useWizard<BedrockWizardData>()
  const [value, setValue] = useState(wizardData.region ?? 'us-east-1')
  const [cursorOffset, setCursorOffset] = useState(value.length)
  const [error, setError] = useState<string | null>(null)

  useKeybinding('confirm:no', goBack, { context: 'Settings' })

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Region is required')
      return
    }
    setError(null)
    updateWizardData({ region: trimmed })
    goNext()
  }

  return (
    <WizardDialogLayout
      subtitle="AWS region"
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
        <Text>Where your Bedrock models are enabled.</Text>
        <Text dimColor>
          Claude Code reads this from AWS_REGION, not ~/.aws/config — set it
          explicitly even if your profile has a region.
        </Text>
        <Box marginTop={1}>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="us-east-1"
            columns={40}
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
