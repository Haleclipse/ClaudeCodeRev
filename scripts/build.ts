/**
 * Build script for Claude Code rebuild.
 *
 * Replicates the original Bun bundler pipeline:
 *   1. Resolve feature flags → compile-time booleans
 *   2. Replace MACRO.* constants
 *   3. Bundle src/entrypoints/cli.tsx → dist/cli.js (single-file ESM)
 *   4. Prepend shebang
 *
 * Usage:
 *   bun run scripts/build.ts            # production (external features off)
 *   bun run scripts/build.ts --dev      # development (all features on)
 *   bun run scripts/build.ts --sourcemap # with sourcemap
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const isDev = args.includes('--dev')
const withSourcemap = args.includes('--sourcemap')

const ROOT = join(dirname(import.meta.dir), '')
const DIST = join(ROOT, 'dist')
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

mkdirSync(DIST, { recursive: true })

// ---------------------------------------------------------------------------
// Feature flags
//
// In production (npm) builds, most internal/experimental features are OFF.
// In --dev mode all flags default to true for local testing.
// Override individual flags via env: FEATURE_DAEMON=true bun run build
// ---------------------------------------------------------------------------
const FEATURE_FLAGS: Record<string, boolean> = {
  // === Generally available (ON in production) ===
  BRIDGE_MODE: true,
  BG_SESSIONS: false, // official 2.1.88: gated modules absent from its sourcemap
  TEMPLATES: false, // official 2.1.88: gated modules absent from its sourcemap
  BUILTIN_EXPLORE_PLAN_AGENTS: true,
  FORK_SUBAGENT: false, // official 2.1.88: gated modules absent from its sourcemap
  SLOW_OPERATION_LOGGING: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  COMPACTION_REMINDERS: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  EXTRACT_MEMORIES: true,
  HISTORY_PICKER: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  HISTORY_SNIP: false, // official 2.1.88: gated modules absent from its sourcemap
  CONTEXT_COLLAPSE: false, // official 2.1.88: gated modules absent from its sourcemap
  AUTO_THEME: false, // official 2.1.88: gated modules absent from its sourcemap
  REACTIVE_COMPACT: false, // official 2.1.88: gated modules absent from its sourcemap
  CACHED_MICROCOMPACT: false, // official 2.1.88: gated modules absent from its sourcemap
  TOKEN_BUDGET: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  STREAMLINED_OUTPUT: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  FILE_PERSISTENCE: false, // official 2.1.88: with it on, utils/filePersistence/types.ts gets bundled; official tree-shakes it
  CONNECTOR_TEXT: false, // official 2.1.88: with it on, types/connectorText.ts gets bundled; official tree-shakes it
  MCP_RICH_OUTPUT: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  MCP_SKILLS: false, // official 2.1.88: gated modules absent from its sourcemap
  HOOK_PROMPTS: false, // official 2.1.88: REPL getToolUseContext passes requestPrompt: void 0
  PROACTIVE: false, // official 2.1.88: gated modules absent from its sourcemap
  BUILDING_CLAUDE_APPS: true,
  UNATTENDED_RETRY: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  COMMIT_ATTRIBUTION: false, // official 2.1.88: gated modules absent from its sourcemap
  PROMPT_CACHE_BREAK_DETECTION: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  DOWNLOAD_USER_SETTINGS: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  UPLOAD_USER_SETTINGS: false, // official 2.1.88: bundle token-distance search; module-presence evidence was a false positive
  SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  QUICK_SEARCH: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  MESSAGE_ACTIONS: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  SKILL_IMPROVEMENT: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  EXPERIMENTAL_SKILL_SEARCH: false, // official 2.1.88: gated modules absent from its sourcemap
  RUN_SKILL_GENERATOR: false, // official 2.1.88: gated modules absent from its sourcemap
  BASH_CLASSIFIER: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  TRANSCRIPT_CLASSIFIER: true,
  WORKFLOW_SCRIPTS: false, // official 2.1.88: gated modules absent from its sourcemap
  AGENT_MEMORY_SNAPSHOT: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  AWAY_SUMMARY: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  AGENT_TRIGGERS: true,
  AGENT_TRIGGERS_REMOTE: true,
  POWERSHELL_AUTO_MODE: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  TEAMMEM: true,
  REVIEW_ARTIFACT: false, // official 2.1.88: gated modules absent from its sourcemap
  ULTRAPLAN: false, // official 2.1.88: bundle token-distance search; module-presence evidence was a false positive
  ULTRATHINK: true,
  TORCH: false, // official 2.1.88: gated modules absent from its sourcemap
  VERIFICATION_AGENT: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  NEW_INIT: true,
  HARD_FAIL: false, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)

  // === Platform-specific (detected at build time) ===
  IS_LIBC_GLIBC: process.platform === 'linux',
  IS_LIBC_MUSL: false,

  // === Internal/experimental (OFF in production, ON in --dev) ===
  ABLATION_BASELINE: isDev,
  DUMP_SYSTEM_PROMPT: isDev,
  DAEMON: isDev,
  SELF_HOSTED_RUNNER: isDev,
  BYOC_ENVIRONMENT_RUNNER: isDev,
  CHICAGO_MCP: true, // official 2.1.88: gated modules present in its sourcemap
  WEB_BROWSER_TOOL: isDev,
  VOICE_MODE: true, // official 2.1.88: gated modules present in its sourcemap
  BUDDY: isDev,
  KAIROS: isDev,
  KAIROS_BRIEF: true, // official 2.1.88: gates commands/brief.ts, present in its sourcemap (KAIROS itself is off)
  KAIROS_CHANNELS: true, // official 2.1.88: gates the channel components present in its sourcemap
  KAIROS_DREAM: isDev,
  KAIROS_GITHUB_WEBHOOKS: isDev,
  KAIROS_PUSH_NOTIFICATION: isDev,
  LODESTONE: true, // official 2.1.88: gated modules present in its sourcemap
  MONITOR_TOOL: isDev,
  COORDINATOR_MODE: isDev,
  SSH_REMOTE: isDev,
  DIRECT_CONNECT: isDev,
  NATIVE_CLIENT_ATTESTATION: true, // official 2.1.88: system prompt carries the " cch=00000;" placeholder
  NATIVE_CLIPBOARD_IMAGE: true, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  UDS_INBOX: isDev,
  TERMINAL_PANEL: isDev,
  SHOT_STATS: isDev,
  CCR_AUTO_CONNECT: false, // official 2.1.88: bundle token-distance search; module-presence evidence was a false positive
  CCR_MIRROR: isDev,
  CCR_REMOTE_SETUP: true, // official 2.1.88: gated modules present in its sourcemap
  ENHANCED_TELEMETRY_BETA: true, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
  COWORKER_TYPE_TELEMETRY: isDev,
  MEMORY_SHAPE_TELEMETRY: isDev,
  PERFETTO_TRACING: isDev,
  ANTI_DISTILLATION_CC: isDev,
  ALLOW_TEST_VERSIONS: isDev,
  BREAK_CACHE_COMMAND: isDev,
  OVERFLOW_TEST_TOOL: isDev,
  TREE_SITTER_BASH: isDev,
  TREE_SITTER_BASH_SHADOW: true, // official 2.1.88: bundle token-distance search (version-diff/flag-search.mjs)
}

// Env overrides: FEATURE_DAEMON=true
for (const [key, _] of Object.entries(FEATURE_FLAGS)) {
  const envVal = process.env[`FEATURE_${key}`]
  if (envVal !== undefined) {
    FEATURE_FLAGS[key] = envVal === 'true' || envVal === '1'
  }
}

// ---------------------------------------------------------------------------
// MACRO replacements
// ---------------------------------------------------------------------------
const MACROS: Record<string, string> = {
  'MACRO.VERSION': JSON.stringify(VERSION),
  'MACRO.BUILD_TIME': JSON.stringify(new Date().toISOString()),
  'MACRO.PACKAGE_URL': JSON.stringify(`https://www.npmjs.com/package/@anthropic-ai/claude-code/v/${VERSION}`),
  'MACRO.NATIVE_PACKAGE_URL': JSON.stringify(''),
  'MACRO.VERSION_CHANGELOG': JSON.stringify(''),
  'MACRO.FEEDBACK_CHANNEL': JSON.stringify('https://github.com/anthropics/claude-code/issues'),
  'MACRO.ISSUES_EXPLAINER': JSON.stringify('https://github.com/anthropics/claude-code/issues'),
}

// ---------------------------------------------------------------------------
// bun:bundle feature flags — native compile-time folding.
//
// `import { feature } from 'bun:bundle'` is a Bun built-in: `Bun.build({ features })`
// folds each `feature('FLAG')` to a boolean literal and drops the dead branch
// *before* resolving its imports, so `feature('X') ? require('./gated.js') : null`
// never tries to resolve a module that the public build doesn't ship. Bun >= 1.3
// handles `bun:bundle` itself: the earlier shim plugin was never invoked and the
// regex post-process had nothing to replace, so every flag folded to false.
// ---------------------------------------------------------------------------
const ENABLED_FEATURES = Object.entries(FEATURE_FLAGS)
  .filter(([_, on]) => on)
  .map(([name]) => name)

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

// Build define map: MACRO.* constants (feature() is folded via `features` above).
const define: Record<string, string> = {}
for (const [key, val] of Object.entries(MACROS)) {
  define[key] = val
}
// Compile-time process.env constants, as in the official external build. The
// ant-only / opt-in modules these gate (REPLTool, SuggestBackgroundPRTool,
// agents-platform, VerifyPlanExecutionTool) are not in the published sources,
// so their require() branches must be folded away or the bundle can't resolve.
define['process.env.USER_TYPE'] = JSON.stringify('external')
define['process.env.CLAUDE_CODE_VERIFY_PLAN'] = 'undefined'

async function main() {
  const startTime = Date.now()

  console.log(`Building Claude Code v${VERSION}`)
  console.log(`  Mode: ${isDev ? 'development' : 'production'}`)
  console.log(`  Sourcemap: ${withSourcemap}`)
  console.log(`  Features ON: ${ENABLED_FEATURES.length}/${Object.keys(FEATURE_FLAGS).length}`)

  const result = await Bun.build({
    entrypoints: [join(ROOT, 'src/entrypoints/cli.tsx')],
    outdir: DIST,
    target: 'node',
    format: 'esm',
    minify: !isDev,
    sourcemap: withSourcemap ? 'external' : 'none',
    define,
    // `features` is not in older bun-types; it is honored by Bun >= 1.3.
    ...({ features: ENABLED_FEATURES } as Record<string, unknown>),
    // .md must load as raw text: Bun's default renders Markdown to HTML, while the
    // official bundle embeds the skill docs verbatim ("# Claude API — Java", not "<h1>").
    loader: { '.md': 'text', '.txt': 'text' },
    // Externalize Node builtins (they're loaded via createRequire at runtime)
    external: [
      'bun:ffi',  // guarded by typeof Bun at runtime
    ],
  })

  if (!result.success) {
    console.error('Build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  const outFile = join(DIST, 'cli.js')
  let code = readFileSync(outFile, 'utf8')

  // Prepend shebang
  if (!code.startsWith('#!')) {
    code = `#!/usr/bin/env node\n// Claude Code v${VERSION} (rebuild)\n` + code
  }

  writeFileSync(outFile, code)

  // Copy sdk-tools.d.ts if it exists
  const sdkToolsSrc = join(ROOT, 'sdk-tools.d.ts')
  if (existsSync(sdkToolsSrc)) {
    copyFileSync(sdkToolsSrc, join(DIST, 'sdk-tools.d.ts'))
  }

  const elapsed = Date.now() - startTime
  const size = (readFileSync(outFile).length / 1024 / 1024).toFixed(1)
  console.log(`\n  Output: dist/cli.js (${size} MB)`)
  console.log(`  Done in ${elapsed}ms`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
