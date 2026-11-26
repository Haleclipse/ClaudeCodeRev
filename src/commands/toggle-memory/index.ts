import { feature } from 'bun:bundle'
import { getMemoryToggledOff } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'
import { isAutoMemoryEnabled } from '../../memdir/paths.js'

// Not released: the gate is off in external builds (official bundles through
// 2.1.112 ship `isEnabled: () => false`); its name and condition are not in
// the bundle.
const toggleMemory = {
  type: 'local',
  name: 'toggle-memory',
  description: 'Toggle automemory off/on for this session',
  isEnabled: () =>
    feature('TOGGLE_MEMORY')
      ? isAutoMemoryEnabled() || getMemoryToggledOff()
      : false,
  isHidden: false,
  supportsNonInteractive: false,
  load: () => import('./toggle-memory.js'),
  userFacingName() {
    return 'toggle-memory'
  },
} satisfies Command

export default toggleMemory
