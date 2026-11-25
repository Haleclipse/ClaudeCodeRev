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
  SLOW_OPERATION_LOGGING: true,
  COMPACTION_REMINDERS: true,
  EXTRACT_MEMORIES: true,
  HISTORY_PICKER: true,
  HISTORY_SNIP: false, // official 2.1.88: gated modules absent from its sourcemap
  CONTEXT_COLLAPSE: false, // official 2.1.88: gated modules absent from its sourcemap
  AUTO_THEME: false, // official 2.1.88: gated modules absent from its sourcemap
  REACTIVE_COMPACT: false, // official 2.1.88: gated modules absent from its sourcemap
  CACHED_MICROCOMPACT: false, // official 2.1.88: gated modules absent from its sourcemap
  TOKEN_BUDGET: true,
  STREAMLINED_OUTPUT: true,
  FILE_PERSISTENCE: true,
  CONNECTOR_TEXT: true,
  MCP_RICH_OUTPUT: true,
  MCP_SKILLS: false, // official 2.1.88: gated modules absent from its sourcemap
  HOOK_PROMPTS: true,
  PROACTIVE: false, // official 2.1.88: gated modules absent from its sourcemap
  BUILDING_CLAUDE_APPS: true,
  UNATTENDED_RETRY: true,
  COMMIT_ATTRIBUTION: false, // official 2.1.88: gated modules absent from its sourcemap
  PROMPT_CACHE_BREAK_DETECTION: true,
  DOWNLOAD_USER_SETTINGS: true,
  UPLOAD_USER_SETTINGS: true,
  SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED: true,
  QUICK_SEARCH: true,
  MESSAGE_ACTIONS: true,
  SKILL_IMPROVEMENT: true,
  EXPERIMENTAL_SKILL_SEARCH: false, // official 2.1.88: gated modules absent from its sourcemap
  RUN_SKILL_GENERATOR: false, // official 2.1.88: gated modules absent from its sourcemap
  BASH_CLASSIFIER: true,
  TRANSCRIPT_CLASSIFIER: true,
  WORKFLOW_SCRIPTS: false, // official 2.1.88: gated modules absent from its sourcemap
  AGENT_MEMORY_SNAPSHOT: true,
  AWAY_SUMMARY: true,
  AGENT_TRIGGERS: true,
  AGENT_TRIGGERS_REMOTE: true,
  POWERSHELL_AUTO_MODE: true,
  TEAMMEM: true,
  REVIEW_ARTIFACT: false, // official 2.1.88: gated modules absent from its sourcemap
  ULTRAPLAN: true,
  ULTRATHINK: true,
  TORCH: false, // official 2.1.88: gated modules absent from its sourcemap
  VERIFICATION_AGENT: true,
  NEW_INIT: true,
  HARD_FAIL: true,

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
  KAIROS_BRIEF: isDev,
  KAIROS_CHANNELS: isDev,
  KAIROS_DREAM: isDev,
  KAIROS_GITHUB_WEBHOOKS: isDev,
  KAIROS_PUSH_NOTIFICATION: isDev,
  LODESTONE: true, // official 2.1.88: gated modules present in its sourcemap
  MONITOR_TOOL: isDev,
  COORDINATOR_MODE: isDev,
  SSH_REMOTE: isDev,
  DIRECT_CONNECT: isDev,
  NATIVE_CLIENT_ATTESTATION: isDev,
  NATIVE_CLIPBOARD_IMAGE: isDev,
  UDS_INBOX: isDev,
  TERMINAL_PANEL: isDev,
  SHOT_STATS: isDev,
  CCR_AUTO_CONNECT: true, // official 2.1.88: gated modules present in its sourcemap
  CCR_MIRROR: isDev,
  CCR_REMOTE_SETUP: true, // official 2.1.88: gated modules present in its sourcemap
  ENHANCED_TELEMETRY_BETA: isDev,
  COWORKER_TYPE_TELEMETRY: isDev,
  MEMORY_SHAPE_TELEMETRY: isDev,
  PERFETTO_TRACING: isDev,
  ANTI_DISTILLATION_CC: isDev,
  ALLOW_TEST_VERSIONS: isDev,
  BREAK_CACHE_COMMAND: isDev,
  OVERFLOW_TEST_TOOL: isDev,
  TREE_SITTER_BASH: isDev,
  TREE_SITTER_BASH_SHADOW: isDev,
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
// Compile-time process.env constants. Official 2.1.88 contains no `process.env.USER_TYPE`
// at all and keeps only the external branches of `USER_TYPE === 'ant'`; likewise the
// top-level `CLAUDE_CODE_VERIFY_PLAN === 'true'` tool gate is folded away.
const ENV_DEFINES: Record<string, string> = {
  'process.env.USER_TYPE': JSON.stringify('external'),
  'process.env.CLAUDE_CODE_VERIFY_PLAN': 'undefined',
  // Official bundles the *.production.js builds of react, react-reconciler, scheduler
  // and dom-mutator, and contains no `process.env.NODE_ENV` reference.
  ...(isDev ? {} : { 'process.env.NODE_ENV': JSON.stringify('production') }),
}

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
// never tries to resolve a module that the public build doesn't ship. This is
// the mechanism the official build uses; the earlier shim plugin + regex
// post-process only worked on Bun versions that happened to fold the shim call.
// ---------------------------------------------------------------------------
const ENABLED_FEATURES = Object.entries(FEATURE_FLAGS)
  .filter(([_, on]) => on)
  .map(([name]) => name)

// Official 2.1.88 was built with Bun 1.3.11 (an internal build, 1.3.11+759ce8024;
// its bundler/installer changes vs. the public 1.3.11 release are comments only
// plus a CSS-only-entry chunking fix that doesn't apply here). Other versions
// change minifier/bundler output and add noise to bundle comparisons.
const EXPECTED_BUN = '1.3.11'

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

// For MACRO.*, we use `define` directly.
const define: Record<string, string> = { ...ENV_DEFINES }
for (const [key, val] of Object.entries(MACROS)) {
  define[key] = val
}

async function main() {
  const startTime = Date.now()

  console.log(`Building Claude Code v${VERSION}`)
  console.log(`  Bun: ${Bun.version}${Bun.version === EXPECTED_BUN ? '' : ` (expected ${EXPECTED_BUN} — output will differ from the official build)`}`)
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
    // Shebang + marker as a banner so Bun accounts for it in the sourcemap.
    banner: `#!/usr/bin/env node\n// Claude Code v${VERSION} (rebuild)`,
    // `features` is not in older bun-types; it is honored by Bun >= 1.3.
    ...({ features: ENABLED_FEATURES } as Record<string, unknown>),
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

  // No post-processing of cli.js: feature() is folded natively and the shebang
  // comes from `banner`. Rewriting the output after the build would shift every
  // line without updating the external sourcemap.
  const outFile = join(DIST, 'cli.js')

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
