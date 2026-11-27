import { feature } from 'bun:bundle'
import type { SystemInformationalMessage } from './types/message.js'
import { createSystemMessage } from './utils/messages.js'

// Dead code elimination: conditional import for TEAM_ONBOARDING
/* eslint-disable @typescript-eslint/no-require-imports */
const teamOnboardingModule = feature('TEAM_ONBOARDING')
  ? (require('./commands/team-onboarding/index.js') as typeof import('./commands/team-onboarding/index.js'))
  : null
/* eslint-enable @typescript-eslint/no-require-imports */

export function getTeamOnboardingDiscoveryMessages(opts: {
  onboardingShown: boolean
}): SystemInformationalMessage[] {
  const messages: SystemInformationalMessage[] = []
  if (
    opts.onboardingShown &&
    teamOnboardingModule &&
    teamOnboardingModule.resolveTeamOnboardingDiscoveryArm() === 'banner'
  ) {
    const copy = teamOnboardingModule.TEAM_ONBOARDING_DISCOVERY_COPY
    messages.push(createSystemMessage(`${copy.heading} ${copy.body}`, 'suggestion'))
  }
  return messages
}
