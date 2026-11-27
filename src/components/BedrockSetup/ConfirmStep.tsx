import React, { type ReactNode, useState } from 'react'
import { Box, Text } from '../../ink.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'
import { Select } from '../CustomSelect/select.js'
import { StatusIcon } from '../design-system/StatusIcon.js'
import { useWizard } from '../wizard/index.js'
import { WizardDialogLayout } from '../wizard/WizardDialogLayout.js'
import type { BedrockWizardData } from './steps.js'

function buildBedrockEnv(
  data: BedrockWizardData,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    CLAUDE_CODE_USE_BEDROCK: '1',
    AWS_REGION: data.region,
    AWS_PROFILE: undefined,
    AWS_BEARER_TOKEN_BEDROCK: undefined,
    AWS_ACCESS_KEY_ID: undefined,
    AWS_SECRET_ACCESS_KEY: undefined,
    AWS_SESSION_TOKEN: undefined,
    ANTHROPIC_DEFAULT_SONNET_MODEL: undefined,
    ANTHROPIC_DEFAULT_OPUS_MODEL: undefined,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: undefined,
  }
  switch (data.authMethod) {
    case 'profile':
      env.AWS_PROFILE = data.awsProfile
      break
    case 'bearer':
      env.AWS_BEARER_TOKEN_BEDROCK = data.bearerToken
      break
    case 'accessKey':
      env.AWS_ACCESS_KEY_ID = data.accessKeyId
      env.AWS_SECRET_ACCESS_KEY = data.secretAccessKey
      if (data.sessionToken) env.AWS_SESSION_TOKEN = data.sessionToken
      break
    case 'environment':
    case undefined:
      break
  }
  if (data.pinSonnet) env.ANTHROPIC_DEFAULT_SONNET_MODEL = data.pinSonnet
  if (data.pinOpus) env.ANTHROPIC_DEFAULT_OPUS_MODEL = data.pinOpus
  if (data.pinHaiku) env.ANTHROPIC_DEFAULT_HAIKU_MODEL = data.pinHaiku
  return env
}

const HIDDEN_ENV_VARS = new Set([
  'AWS_BEARER_TOKEN_BEDROCK',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
])

export function ConfirmStep({
  onComplete,
}: {
  onComplete: (message: string) => void
}): ReactNode {
  const { goBack, wizardData } = useWizard<BedrockWizardData>()
  const [error, setError] = useState<string | null>(null)

  const env = buildBedrockEnv(wizardData)
  const entries = Object.entries(env).filter(entry => entry[1] !== undefined)

  const handleSave = (): void => {
    const { error: saveError } = updateSettingsForSource('userSettings', {
      env,
    })
    if (saveError) {
      setError(saveError.message)
      return
    }
    logEvent('tengu_bedrock_setup_complete', {
      auth_method:
        wizardData.authMethod as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      pinned_models: String(
        Boolean(
          wizardData.pinSonnet || wizardData.pinOpus || wizardData.pinHaiku,
        ),
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      verified: String(
        Boolean(wizardData.verifiedIdentity),
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    onComplete(
      `Bedrock configuration saved to ~/.claude/settings.json. Restart Claude Code to apply.${wizardData.authMethod === 'profile' ? ` When your SSO session expires (typically 8 hours), run \`aws sso login --profile ${wizardData.awsProfile}\` — Claude Code picks up refreshed credentials automatically.` : ''}`,
    )
  }

  return (
    <WizardDialogLayout subtitle="Confirm and save">
      <Box flexDirection="column" gap={1}>
        <Text>These will be written to ~/.claude/settings.json under env:</Text>
        <Box flexDirection="column">
          {entries.map(([key, value]) => (
            <Text key={key}>
              {'  '}
              <Text color="suggestion">{key}</Text> ={' '}
              {HIDDEN_ENV_VARS.has(key) ? (
                <Text dimColor>(hidden)</Text>
              ) : (
                value
              )}
            </Text>
          ))}
        </Box>
        {wizardData.verifiedIdentity && (
          <Text dimColor>
            <StatusIcon status="success" withSpace />
            Verified as {wizardData.verifiedIdentity}
          </Text>
        )}
        {error && <Text color="error">{error}</Text>}
        <Select
          options={[
            { label: 'Save', value: 'save' },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onChange={value => {
            if (value === 'save') handleSave()
            else goBack()
          }}
          onCancel={goBack}
        />
      </Box>
    </WizardDialogLayout>
  )
}
