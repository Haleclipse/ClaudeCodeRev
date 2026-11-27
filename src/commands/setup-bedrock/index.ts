import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'setup-bedrock',
  description: 'Reconfigure AWS Bedrock authentication, region, or model pins',
  get isHidden() {
    return !isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
  },
  load: () => import('./setup-bedrock.js'),
} satisfies Command
