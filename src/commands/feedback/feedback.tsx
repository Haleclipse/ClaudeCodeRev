import * as React from 'react'
import type {
  CommandResultDisplay,
  LocalJSXCommandContext,
} from '../../commands.js'
import { Feedback } from '../../components/Feedback.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { Message } from '../../types/message.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'

const ISSUES_URL = 'https://github.com/anthropics/claude-code/issues'

// Why /feedback can't be used in this session, or null when it can.
export function getFeedbackUnavailableReason(): string | null {
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)) {
    return `/feedback is not available when using Amazon Bedrock. Report issues at ${ISSUES_URL}`
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)) {
    return `/feedback is not available when using Vertex AI. Report issues at ${ISSUES_URL}`
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)) {
    return `/feedback is not available when using Microsoft Foundry. Report issues at ${ISSUES_URL}`
  }
  if (isEnvTruthy(process.env.DISABLE_FEEDBACK_COMMAND)) {
    return '/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable'
  }
  if (isEnvTruthy(process.env.DISABLE_BUG_COMMAND)) {
    return '/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable'
  }
  if (isEssentialTrafficOnly()) {
    return '/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable'
  }
  if (!isPolicyAllowed('allow_product_feedback')) {
    return "/feedback has been disabled by your organization's policy"
  }
  return null
}

// Shared function to render the Feedback component
export function renderFeedbackComponent(
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void,
  abortSignal: AbortSignal,
  messages: Message[],
  initialDescription: string = '',
  backgroundTasks: {
    [taskId: string]: {
      type: string
      identity?: { agentId: string }
      messages?: Message[]
    }
  } = {},
): React.ReactNode {
  return (
    <Feedback
      abortSignal={abortSignal}
      messages={messages}
      initialDescription={initialDescription}
      onDone={onDone}
      backgroundTasks={backgroundTasks}
    />
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode> {
  const unavailableReason = getFeedbackUnavailableReason()
  if (unavailableReason) {
    onDone(unavailableReason)
    return null
  }
  const initialDescription = args || ''
  return renderFeedbackComponent(
    onDone,
    context.abortController.signal,
    context.messages,
    initialDescription,
  )
}
