import React, { type ReactNode, useRef } from 'react'
import { WizardProvider } from '../wizard/index.js'
import { AccessKeyIdStep } from './AccessKeyIdStep.js'
import { AuthMethodStep } from './AuthMethodStep.js'
import { BearerTokenStep } from './BearerTokenStep.js'
import { ConfirmStep } from './ConfirmStep.js'
import { PinModelsStep } from './PinModelsStep.js'
import { ProfileStep } from './ProfileStep.js'
import { RegionStep } from './RegionStep.js'
import { SecretAccessKeyStep } from './SecretAccessKeyStep.js'
import { SessionTokenStep } from './SessionTokenStep.js'
import type { BedrockWizardData } from './steps.js'
import { VerifyStep } from './VerifyStep.js'

type Props = {
  onComplete: (message: string) => void
  onCancel: () => void
}

export function BedrockSetupWizard({ onComplete, onCancel }: Props): ReactNode {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Step order must match BEDROCK_STEP.
  const [steps] = React.useState(() => [
    AuthMethodStep,
    ProfileStep,
    BearerTokenStep,
    AccessKeyIdStep,
    SecretAccessKeyStep,
    SessionTokenStep,
    RegionStep,
    VerifyStep,
    PinModelsStep,
    () => (
      <ConfirmStep onComplete={message => onCompleteRef.current(message)} />
    ),
  ])

  return (
    <WizardProvider<BedrockWizardData>
      steps={steps}
      initialData={{}}
      onComplete={() => {}}
      onCancel={onCancel}
      title="Set up AWS Bedrock"
      showStepCounter={false}
    />
  )
}
