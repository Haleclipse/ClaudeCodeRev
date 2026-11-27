import React, { type ReactNode, useEffect, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { plural } from '../../utils/stringUtils.js'
import { Select } from '../CustomSelect/select.js'
import { LoadingState } from '../design-system/LoadingState.js'
import { StatusIcon } from '../design-system/StatusIcon.js'
import { useWizard } from '../wizard/index.js'
import { WizardDialogLayout } from '../wizard/WizardDialogLayout.js'
import type { BedrockWizardData } from './steps.js'
import { type VerifyResult, verifyBedrockCredentials } from './verify.js'

type VerifyState =
  | { phase: 'checking' }
  | { phase: 'done'; result: VerifyResult }

export function VerifyStep(): ReactNode {
  const { goBack, goNext, updateWizardData, wizardData } =
    useWizard<BedrockWizardData>()
  const [state, setState] = useState<VerifyState>({ phase: 'checking' })

  useEffect(() => {
    let cancelled = false
    void verifyBedrockCredentials(wizardData).then(result => {
      if (cancelled) return
      if (result.status === 'ok')
        updateWizardData({
          verifiedIdentity: result.identity,
          discoveredProfiles: result.profiles,
        })
      setState({ phase: 'done', result })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.phase === 'checking') {
    return (
      <WizardDialogLayout subtitle="Verifying credentials">
        <LoadingState
          message={
            wizardData.authMethod === 'bearer'
              ? 'Sending a test request to Bedrock…'
              : 'Calling AWS STS and Bedrock…'
          }
          subtitle="This may take a few seconds."
        />
      </WizardDialogLayout>
    )
  }

  const { result } = state
  switch (result.status) {
    case 'ok':
      return (
        <WizardDialogLayout subtitle="Verification">
          <Box flexDirection="column" gap={1}>
            <Text>
              <StatusIcon status="success" withSpace />
              Authenticated as <Text bold>{result.identity}</Text>
            </Text>
            <Text dimColor>
              {result.note ??
                (result.profiles.length > 0
                  ? `Found ${result.profiles.length} Anthropic inference ${plural(result.profiles.length, 'profile')} in this region.`
                  : 'No Anthropic inference profiles found in this region. You may still proceed — model defaults will use the built-in IDs.')}
            </Text>
            <Select
              options={[{ label: 'Continue', value: 'continue' }]}
              onChange={() => goNext()}
              onCancel={goBack}
            />
          </Box>
        </WizardDialogLayout>
      )
    case 'error':
      return (
        <WizardDialogLayout subtitle="Verification failed" color="error">
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text>
                <StatusIcon status="error" withSpace />
                {result.error}
              </Text>
              {result.command && (
                <Text bold color="suggestion">
                  {'    '}
                  {result.command}
                </Text>
              )}
            </Box>
            <Select
              options={[
                { label: 'Go back and fix', value: 'back' },
                { label: 'Save anyway (skip verification)', value: 'skip' },
              ]}
              onChange={value => {
                if (value === 'back') goBack()
                else goNext()
              }}
              onCancel={goBack}
            />
          </Box>
        </WizardDialogLayout>
      )
  }
}
