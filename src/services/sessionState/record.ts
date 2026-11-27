// Session state record module. Only its module dependencies are visible in
// the external build.
// Side-effect imports; no visible usage in this build.
import '../analytics/index.js'
import '../../utils/execFileNoThrow.js'
import '../../utils/git.js'
import '../../utils/worktree.js'
import './launch.js'
import './schema.js'
