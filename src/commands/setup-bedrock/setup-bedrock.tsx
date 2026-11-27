import * as React from 'react'
import { BedrockSetupWizard } from '../../components/BedrockSetup/BedrockSetupWizard.js'
import { logEvent } from '../../services/analytics/index.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> {
  logEvent('tengu_bedrock_setup_started', {})
  return (
    <BedrockSetupWizard
      onComplete={message => onDone(message)}
      onCancel={() => {
        logEvent('tengu_bedrock_setup_cancelled', {})
        onDone()
      }}
    />
  )
}
