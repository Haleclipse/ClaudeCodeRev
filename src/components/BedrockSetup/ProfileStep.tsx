import React, { type ReactNode, useEffect, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { plural } from '../../utils/stringUtils.js'
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js'
import { Select } from '../CustomSelect/select.js'
import { Byline } from '../design-system/Byline.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import { LoadingState } from '../design-system/LoadingState.js'
import TextInput from '../TextInput.js'
import { useWizard, type WizardContextValue } from '../wizard/index.js'
import { WizardDialogLayout } from '../wizard/WizardDialogLayout.js'
import { readAwsProfileNames } from './awsProfiles.js'
import { BEDROCK_STEP, type BedrockWizardData } from './steps.js'

const MANUAL_ENTRY = '__manual__'
const MAX_LISTED_PROFILES = 12

type ProfilesState = { phase: 'loading' } | { phase: 'ready'; profiles: string[] }

export function ProfileStep(): ReactNode {
  const { goBack, goToStep, updateWizardData, wizardData } =
    useWizard<BedrockWizardData>()
  const [state, setState] = useState<ProfilesState>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    void readAwsProfileNames().then(profiles => {
      if (!cancelled) setState({ phase: 'ready', profiles })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.phase === 'loading') {
    return (
      <WizardDialogLayout subtitle="AWS profile">
        <LoadingState message="Reading ~/.aws/config…" />
      </WizardDialogLayout>
    )
  }

  return (
    <ProfileChooser
      profiles={state.profiles}
      wizardData={wizardData}
      goBack={goBack}
      goToStep={goToStep}
      updateWizardData={updateWizardData}
    />
  )
}

function ProfileChooser({
  profiles,
  wizardData,
  goBack,
  goToStep,
  updateWizardData,
}: {
  profiles: string[]
  wizardData: BedrockWizardData
  goBack: () => void
  goToStep: (index: number) => void
  updateWizardData: WizardContextValue<BedrockWizardData>['updateWizardData']
}): ReactNode {
  const tooMany = profiles.length > MAX_LISTED_PROFILES
  const currentNotListed = Boolean(
    wizardData.awsProfile && !profiles.includes(wizardData.awsProfile),
  )
  const [manualEntry, setManualEntry] = useState(
    profiles.length === 0 || tooMany || currentNotListed,
  )
  const prepopulated = tooMany
    ? profiles.find(name => name.toLowerCase().includes('bedrock'))
    : undefined
  const [value, setValue] = useState(
    wizardData.awsProfile ?? prepopulated ?? '',
  )
  const [cursorOffset, setCursorOffset] = useState(value.length)
  const [error, setError] = useState<string | null>(null)

  useKeybinding('confirm:no', goBack, {
    context: 'Settings',
    isActive: manualEntry,
  })

  const selectProfile = (awsProfile: string): void => {
    updateWizardData({ awsProfile })
    goToStep(BEDROCK_STEP.REGION)
  }

  if (!manualEntry) {
    return (
      <WizardDialogLayout subtitle="AWS profile">
        <Box flexDirection="column" gap={1}>
          <Text dimColor>
            Found {profiles.length} {plural(profiles.length, 'profile')} in
            ~/.aws/config and ~/.aws/credentials.
          </Text>
          <Select
            options={[
              ...profiles.map(name => ({ label: name, value: name })),
              { label: 'Type a different name…', value: MANUAL_ENTRY },
            ]}
            defaultValue={
              wizardData.awsProfile && profiles.includes(wizardData.awsProfile)
                ? wizardData.awsProfile
                : undefined
            }
            onChange={value => {
              if (value === MANUAL_ENTRY) setManualEntry(true)
              else selectProfile(value)
            }}
            onCancel={goBack}
          />
        </Box>
      </WizardDialogLayout>
    )
  }

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Profile name is required')
      return
    }
    setError(null)
    selectProfile(trimmed)
  }

  return (
    <WizardDialogLayout
      subtitle="AWS profile name"
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
        <Text>The name from ~/.aws/config (after [profile …]).</Text>
        {tooMany && (
          <Text dimColor>
            Found {profiles.length} profiles — too many to list.
            {prepopulated && ` Prepopulated with "${prepopulated}".`}
          </Text>
        )}
        <Text dimColor>
          If this is an SSO profile, run `aws sso login --profile NAME` first.
        </Text>
        <Box marginTop={1}>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="my-bedrock-profile"
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
