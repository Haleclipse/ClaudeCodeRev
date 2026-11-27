// Side-effect imports; no visible usage in this build.
import '../../bootstrap/state.js'
import '../analytics/index.js'
import '../teamMemorySync/secretScanner.js'
import '../../utils/concurrentSessions.js'
import '../../utils/cwd.js'
import '../../utils/debug.js'
import '../../utils/format.js'
import '../../utils/messages.js'
import '../../utils/model/model.js'
import '../../utils/sessionStorage.js'
import '../../utils/sideQuery.js'
import '../../utils/slowOperations.js'
import './schema.js'

// Process launch facts, captured at module initialization.
export const PROCESS_START_TIME = Date.now()
export const IS_RESUME_LAUNCH = process.argv.some(
  arg =>
    arg === '-c' ||
    arg === '--continue' ||
    arg === '-r' ||
    arg === '--resume' ||
    arg.startsWith('--resume='),
)
