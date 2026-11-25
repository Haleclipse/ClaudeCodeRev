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
import { join, dirname, basename } from 'path'
import { createRequire } from 'module'

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
  HOOK_PROMPTS: true,
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
  AWAY_SUMMARY: true, // official 2.1.89: changed from 2.1.88 (bundle token-distance search)
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
  BUDDY: true, // official 2.1.89: changed from 2.1.88 (bundle token-distance search)
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
  TREE_SITTER_BASH: true, // official 2.1.89: changed from 2.1.88 (bundle token-distance search)
  TREE_SITTER_BASH_SHADOW: false, // official 2.1.89: changed from 2.1.88 (bundle token-distance search)
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
  // Folded in the official bundle (zero `process.env.<NAME>` references left); values
  // read off the folded sites, e.g. `isEnvTruthy(process.env.CI)` → `i6(!1)`,
  // ENABLE_LOCKLESS_UPDATES / ENABLE_SESSION_PERSISTENCE / ENABLE_LSP_TOOL → `i6("true")`
  // (the LSP tool is in the official tool list), the rest → `void 0` / dead branches.
  'process.env.CI': 'false',
  'process.env.ENABLE_LOCKLESS_UPDATES': JSON.stringify('true'),
  'process.env.ENABLE_PID_BASED_VERSION_LOCKING': 'undefined',
  'process.env.CLAUDE_CODE_OVERRIDE_DATE': 'undefined',
  'process.env.ENABLE_SESSION_PERSISTENCE': JSON.stringify('true'),
  'process.env.ENABLE_LSP_TOOL': JSON.stringify('true'),
  'process.env.CLAUDE_CODE_PROFILE_QUERY': 'undefined',
}

// MACRO is defined as one object literal, exactly as the official build does: its
// bundle inlines `{ISSUES_EXPLAINER:…,PACKAGE_URL:…,README_URL:…,VERSION:…,
// FEEDBACK_CHANNEL:…,BUILD_TIME:…}` at every use site (key order matters for the
// output). NATIVE_PACKAGE_URL / VERSION_CHANGELOG are not part of it, so they read
// as undefined. BUILD_TIME is second-precision; BUILD_TIME env pins it (e.g. to
// 2026-03-30T21:59:52Z) when comparing against the official bundle.
const MACRO = {
  ISSUES_EXPLAINER: 'report the issue at https://github.com/anthropics/claude-code/issues',
  PACKAGE_URL: '@anthropic-ai/claude-code',
  README_URL: 'https://code.claude.com/docs/en/overview',
  VERSION,
  FEEDBACK_CHANNEL: 'https://github.com/anthropics/claude-code/issues',
  BUILD_TIME: process.env.BUILD_TIME ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
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
// React Compiler — first-party .tsx goes through Babel before Bun bundles it.
//
// The official build's sourcemap holds every src/**/*.tsx as Babel output: types
// and JSX kept (syntax-only parsing), components memoized by
// babel-plugin-react-compiler with `import { c as _c } from "react/compiler-runtime"`,
// and an inline sourcemap appended. @babel/core 7.29.0 + babel-plugin-react-compiler
// 1.0.0 with { target: '19' } reproduces all 552 of them byte-for-byte, inline
// maps included. .ts files are untouched there (identical to the originals), so
// only .tsx is transformed here.
//
// The toolchain lives in build-tools/ with its own lockfile: the app tree's
// overrides and layout pins would otherwise also bind Babel's dependencies
// (e.g. lru-cache), and Babel's dependencies would compete for top-level slots.
// ---------------------------------------------------------------------------
const toolsRequire = createRequire(join(ROOT, 'build-tools', 'package.json'))

const reactCompilerPlugin: import('bun').BunPlugin = {
  name: 'react-compiler',
  setup(build) {
    const babel = toolsRequire('@babel/core')
    const reactCompiler = toolsRequire('babel-plugin-react-compiler')
    const srcDir = join(ROOT, 'src')
    // Babel over 552 files dominates build time (~40s), so cache by content: key =
    // source text + toolchain versions + options; output is deterministic.
    const toolchain = `${babel.version}|${toolsRequire('babel-plugin-react-compiler/package.json').version}|target=19`
    const cacheDir = join(ROOT, 'node_modules', '.cache', 'react-compiler')
    mkdirSync(cacheDir, { recursive: true })
    build.onLoad({ filter: /\.tsx$/ }, ({ path }) => {
      if (!path.startsWith(`${srcDir}/`)) return undefined
      const source = readFileSync(path, 'utf8')
      const key = new Bun.CryptoHasher('sha1').update(`${toolchain}\0${path}\0${source}`).digest('hex')
      const cached = join(cacheDir, `${key}.tsx`)
      if (existsSync(cached)) return { contents: readFileSync(cached, 'utf8'), loader: 'tsx' }
      const out = babel.transformSync(source, {
        filename: path,
        sourceFileName: basename(path),
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ['jsx', 'typescript'] },
        plugins: [[reactCompiler.default ?? reactCompiler, { target: '19' }]],
        sourceMaps: 'inline',
      })
      writeFileSync(cached, out.code)
      return { contents: out.code, loader: 'tsx' }
    })
  },
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

// For MACRO.*, we use `define` directly.
const define: Record<string, string> = { ...ENV_DEFINES, MACRO: JSON.stringify(MACRO) }

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
    plugins: [reactCompilerPlugin],
    // .md must load as raw text: Bun's default renders Markdown to HTML, while the
    // official bundle embeds the skill docs verbatim ("# Claude API — Java", not "<h1>").
    loader: { '.md': 'text', '.txt': 'text' },
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
