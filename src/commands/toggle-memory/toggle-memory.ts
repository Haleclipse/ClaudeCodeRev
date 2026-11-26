import {
  getMemoryToggledOff,
  setMemoryToggledOff,
} from '../../bootstrap/state.js'
import { logEvent } from '../../services/analytics/index.js'
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async () => {
  const toggledOff = !getMemoryToggledOff()
  setMemoryToggledOff(toggledOff)
  logEvent('tengu_memory_toggled', { toggled_off: toggledOff })
  return {
    type: 'text',
    value: toggledOff
      ? 'Automemory disabled for this session · this conversation will not write or read new memories, and previously-loaded memory content should not be referenced.\n\nRun /toggle-memory again to re-enable.'
      : 'Automemory re-enabled · memory content may be referenced and new memories can be saved.',
  }
}
