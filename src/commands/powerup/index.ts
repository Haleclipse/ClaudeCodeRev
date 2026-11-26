import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'powerup',
  description: 'Discover Claude Code features through quick interactive lessons',
  load: () => import('./powerup.js'),
} satisfies Command
