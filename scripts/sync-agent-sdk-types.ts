/**
 * Refresh packages/@anthropic-ai/claude-agent-sdk as a types-only package for
 * the given agent-sdk version.
 *
 * src/entrypoints/sdk/{coreTypes,settingsTypes}.generated.ts and toolTypes.ts
 * are stubs (`export type * from '@anthropic-ai/claude-agent-sdk'`) — their
 * codegen output is not in the sourcemap — and nothing imports the package at
 * runtime. Only the .d.ts files are kept; package.json records `version` and
 * `claudeCodeVersion` so the pin is visible next to the CLI version.
 *
 * Usage: bun run scripts/sync-agent-sdk-types.ts <agent-sdk version>
 *   e.g. 0.2.91 (agent-sdk 0.2.N ships Claude Code 2.1.N)
 */
import { execFileSync } from 'child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const PACKAGE = '@anthropic-ai/claude-agent-sdk'
const TARGET = join(import.meta.dir, '..', 'packages', PACKAGE)
const KEEP_FILES = ['LICENSE.md', 'README.md']

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: bun run scripts/sync-agent-sdk-types.ts <x.y.z>')
  process.exit(1)
}

// Download into a fresh empty directory; the tarball is only read from.
const workDir = mkdtempSync(join(tmpdir(), 'agent-sdk-'))
try {
  execFileSync('npm', ['pack', `${PACKAGE}@${version}`, '--silent'], {
    cwd: workDir,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const tarball = readdirSync(workDir).find(f => f.endsWith('.tgz'))
  if (!tarball) throw new Error(`npm pack produced no tarball for ${version}`)
  execFileSync('tar', ['xzf', tarball], { cwd: workDir })
  const pkgDir = join(workDir, 'package')
  const upstream = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))

  rmSync(TARGET, { recursive: true, force: true })
  mkdirSync(TARGET, { recursive: true })
  const copied: string[] = []
  for (const file of readdirSync(pkgDir)) {
    if (file.endsWith('.d.ts') || KEEP_FILES.includes(file)) {
      copyFileSync(join(pkgDir, file), join(TARGET, file))
      copied.push(file)
    }
  }

  // Types-only exports: keep each subpath's `types` condition, drop runtime.
  const exportsTypes: Record<string, { types: string }> = {}
  for (const [subpath, conditions] of Object.entries(
    upstream.exports as Record<string, { types?: string }>,
  )) {
    if (conditions.types) exportsTypes[subpath] = { types: conditions.types }
  }
  const pkg = {
    name: upstream.name,
    version: upstream.version,
    claudeCodeVersion: upstream.claudeCodeVersion,
    description: `Types-only copy of ${PACKAGE}@${upstream.version} (declarations for src/entrypoints/sdk/*.generated.ts); runtime files omitted. Refresh with scripts/sync-agent-sdk-types.ts.`,
    type: upstream.type,
    types: upstream.types,
    exports: exportsTypes,
    license: upstream.license,
    // Packages the declarations import from
    dependencies: upstream.dependencies,
    peerDependencies: upstream.peerDependencies,
  }
  writeFileSync(join(TARGET, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  console.log(
    `${PACKAGE}@${upstream.version} (Claude Code ${upstream.claudeCodeVersion}): ${copied.join(', ')}`,
  )
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
