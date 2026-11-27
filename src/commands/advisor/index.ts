import type { Command } from '../../commands.js'
import { ADVISOR_TIERS, isAdvisorEnabled } from '../../utils/advisor.js'

export default {
  type: 'local-jsx',
  name: 'advisor',
  description:
    'Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task',
  argumentHint: `[${[...ADVISOR_TIERS, 'off'].join('|')}]`,
  isEnabled: () => isAdvisorEnabled(),
  get isHidden() {
    return !isAdvisorEnabled()
  },
  load: () => import('./advisor.js'),
} satisfies Command
