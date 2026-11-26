import type { Command } from '../../commands.js'

const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `Submit feedback about Claude Code`,
  argumentHint: '[report]',
  // Listed even when feedback is unavailable; call() reports the reason
  // instead of hiding the command (see getFeedbackUnavailableReason).
  // The ant exclusion is not observable in the external bundle (folds to true).
  isEnabled: () => process.env.USER_TYPE !== 'ant',
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback
