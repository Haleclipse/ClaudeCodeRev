import type { Command } from '../../commands.js'

const stopHook = {
  type: 'local-jsx',
  name: 'stop-hook',
  description: 'Set a session-only Stop hook with a quick prompt',
  immediate: true,
  isEnabled: () => false,
  load: () => import('./stop-hook.js'),
} satisfies Command

export default stopHook
