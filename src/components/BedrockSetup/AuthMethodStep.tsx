import React, { type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { Select } from '../CustomSelect/select.js'
import { useWizard } from '../wizard/index.js'
import { WizardDialogLayout } from '../wizard/WizardDialogLayout.js'
import {
  BEDROCK_STEP,
  type BedrockAuthMethod,
  type BedrockWizardData,
} from './steps.js'

export function AuthMethodStep(): ReactNode {
  const { goBack, goToStep, updateWizardData } = useWizard<BedrockWizardData>()

  const options = [
    { label: 'AWS profile (SSO or named profile)', value: 'profile' as const },
    { label: 'Bedrock API key (bearer token)', value: 'bearer' as const },
    { label: 'Access key + secret', value: 'accessKey' as const },
    {
      label: 'Use credentials already in my environment',
      value: 'environment' as const,
    },
  ]

  const nextStep: Record<BedrockAuthMethod, number> = {
    profile: BEDROCK_STEP.PROFILE,
    bearer: BEDROCK_STEP.BEARER,
    accessKey: BEDROCK_STEP.ACCESS_KEY_ID,
    environment: BEDROCK_STEP.REGION,
  }

  const handleChange = (value: string): void => {
    const authMethod = value as BedrockAuthMethod
    updateWizardData({ authMethod })
    goToStep(nextStep[authMethod])
  }

  return (
    <WizardDialogLayout subtitle="How do you authenticate to AWS?">
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          Claude Code uses the standard AWS credential chain. Pick the method
          you already use with the AWS CLI.
        </Text>
        <Select options={options} onChange={handleChange} onCancel={goBack} />
      </Box>
    </WizardDialogLayout>
  )
}
