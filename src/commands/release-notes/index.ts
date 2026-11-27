import type { Command } from '../../commands.js'

const releaseNotes: Command = {
  description: 'View release notes',
  name: 'release-notes',
  type: 'local-jsx',
  load: () => import('./release-notes.js'),
}

export default releaseNotes
