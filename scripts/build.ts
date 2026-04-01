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
  BG_SESSIONS: true,
  TEMPLATES: true,
  BUILTIN_EXPLORE_PLAN_AGENTS: true,
  FORK_SUBAGENT: true,
  SLOW_OPERATION_LOGGING: true,
  COMPACTION_REMINDERS: true,
  EXTRACT_MEMORIES: true,
  HISTORY_PICKER: true,
  HISTORY_SNIP: true,
  CONTEXT_COLLAPSE: true,
  AUTO_THEME: true,
  REACTIVE_COMPACT: true,
  CACHED_MICROCOMPACT: true,
  TOKEN_BUDGET: true,
  STREAMLINED_OUTPUT: true,
  FILE_PERSISTENCE: true,
  CONNECTOR_TEXT: true,
  MCP_RICH_OUTPUT: true,
  MCP_SKILLS: true,
  HOOK_PROMPTS: true,
  PROACTIVE: true,
  BUILDING_CLAUDE_APPS: true,
  UNATTENDED_RETRY: true,
  COMMIT_ATTRIBUTION: true,
  PROMPT_CACHE_BREAK_DETECTION: true,
  DOWNLOAD_USER_SETTINGS: true,
  UPLOAD_USER_SETTINGS: true,
  SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED: true,
  QUICK_SEARCH: true,
  MESSAGE_ACTIONS: true,
  SKILL_IMPROVEMENT: true,
  EXPERIMENTAL_SKILL_SEARCH: true,
  RUN_SKILL_GENERATOR: true,
  BASH_CLASSIFIER: true,
  TRANSCRIPT_CLASSIFIER: true,
  WORKFLOW_SCRIPTS: true,
  AGENT_MEMORY_SNAPSHOT: true,
  AWAY_SUMMARY: true,
  AGENT_TRIGGERS: true,
  AGENT_TRIGGERS_REMOTE: true,
  POWERSHELL_AUTO_MODE: true,
  TEAMMEM: true,
  REVIEW_ARTIFACT: true,
  ULTRAPLAN: true,
  ULTRATHINK: true,
  TORCH: true,
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
  CHICAGO_MCP: isDev,
  WEB_BROWSER_TOOL: isDev,
  VOICE_MODE: isDev,
  BUDDY: isDev,
  KAIROS: isDev,
  KAIROS_BRIEF: isDev,
  KAIROS_CHANNELS: isDev,
  KAIROS_DREAM: isDev,
  KAIROS_GITHUB_WEBHOOKS: isDev,
  KAIROS_PUSH_NOTIFICATION: isDev,
  LODESTONE: isDev,
  MONITOR_TOOL: isDev,
  COORDINATOR_MODE: isDev,
  SSH_REMOTE: isDev,
  DIRECT_CONNECT: isDev,
  NATIVE_CLIENT_ATTESTATION: isDev,
  NATIVE_CLIPBOARD_IMAGE: isDev,
  UDS_INBOX: isDev,
  TERMINAL_PANEL: isDev,
  SHOT_STATS: isDev,
  CCR_AUTO_CONNECT: isDev,
  CCR_MIRROR: isDev,
  CCR_REMOTE_SETUP: isDev,
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
// bun:bundle shim — replace `import { feature } from 'bun:bundle'` and
// `feature('FLAG')` calls with compile-time boolean literals.
// ---------------------------------------------------------------------------

/**
 * Bun plugin that intercepts `bun:bundle` imports and replaces feature()
 * calls with boolean literals for dead code elimination.
 */
const bunBundlePlugin: import('bun').BunPlugin = {
  name: 'bun-bundle-shim',
  setup(build) {
    // Provide a virtual module for `bun:bundle`
    build.onResolve({ filter: /^bun:bundle$/ }, () => ({
      path: 'bun:bundle',
      namespace: 'bun-bundle-shim',
    }))

    build.onLoad({ filter: /.*/, namespace: 'bun-bundle-shim' }, () => ({
      contents: `export function feature(name) { return false; }`,
      loader: 'js',
    }))
  },
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

// Build define map: feature('FLAG') → true/false
// Bun's `define` replaces identifiers, but feature() is a function call.
// We handle it via the plugin above + post-process.
// For MACRO.*, we use `define` directly.
const define: Record<string, string> = {}
for (const [key, val] of Object.entries(MACROS)) {
  define[key] = val
}

async function main() {
  const startTime = Date.now()

  console.log(`Building Claude Code v${VERSION}`)
  console.log(`  Mode: ${isDev ? 'development' : 'production'}`)
  console.log(`  Sourcemap: ${withSourcemap}`)
  console.log(`  Features ON: ${Object.entries(FEATURE_FLAGS).filter(([_, v]) => v).length}/${Object.keys(FEATURE_FLAGS).length}`)

  const result = await Bun.build({
    entrypoints: [join(ROOT, 'src/entrypoints/cli.tsx')],
    outdir: DIST,
    target: 'node',
    format: 'esm',
    minify: !isDev,
    sourcemap: withSourcemap ? 'external' : 'none',
    define,
    plugins: [bunBundlePlugin],
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

  // ---------------------------------------------------------------------------
  // Post-process: replace feature() calls with boolean literals
  //
  // The bun:bundle shim provides a fallback, but Bun's bundler may inline
  // the virtual module. To ensure DCE works, we do a regex pass on the output.
  // ---------------------------------------------------------------------------
  const outFile = join(DIST, 'cli.js')
  let code = readFileSync(outFile, 'utf8')

  // Replace feature("FLAG") / feature('FLAG') with true/false
  code = code.replace(
    /\bfeature\(["']([^"']+)["']\)/g,
    (match, flag) => {
      const value = FEATURE_FLAGS[flag]
      if (value === undefined) {
        console.warn(`  Warning: unknown feature flag "${flag}", defaulting to false`)
        return 'false'
      }
      return String(value)
    },
  )

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
