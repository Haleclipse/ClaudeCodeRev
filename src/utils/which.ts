import { execFileSync } from 'child_process'
import { execa } from 'execa'
import { dirname, join, resolve, sep } from 'path'
import { execSync_DEPRECATED } from './execSyncWrapper.js'

/**
 * SECURITY: Drop results inside the current working directory. Windows
 * resolves bare command names against the cwd before PATH, so a repository
 * could plant `git.exe` / `rg.bat` and have it returned as "the" executable.
 */
function filterOutCwdPaths(paths: string[]): string[] {
  const cwd = process.cwd().toLowerCase()
  return paths.filter(p => {
    const normalized = resolve(p).toLowerCase()
    return (
      dirname(normalized).toLowerCase() !== cwd &&
      !normalized.startsWith(cwd + sep)
    )
  })
}

/** where.exe by absolute path — a bare `where.exe` could itself be hijacked. */
function getWhereExePath(): string {
  const systemRoot = process.env.SYSTEMROOT || 'C:\\Windows'
  return join(systemRoot, 'System32', 'where.exe')
}

async function whichNodeAsync(command: string): Promise<string | null> {
  if (process.platform === 'win32') {
    // On Windows, use where.exe (no shell) and return the first safe result
    const result = await execa(getWhereExePath(), [command], {
      reject: false,
    })
    if (result.exitCode !== 0 || !result.stdout) {
      return null
    }
    // where.exe returns multiple paths separated by newlines
    const paths = result.stdout.trim().split(/\r?\n/).filter(Boolean)
    return filterOutCwdPaths(paths)[0] || null
  }

  // On POSIX systems (macOS, Linux, WSL), use which
  // Cross-platform safe: Windows is handled above
  // eslint-disable-next-line custom-rules/no-cross-platform-process-issues
  const result = await execa(`which ${command}`, {
    shell: true,
    stderr: 'ignore',
    reject: false,
  })
  if (result.exitCode !== 0 || !result.stdout) {
    return null
  }
  return result.stdout.trim()
}

function whichNodeSync(command: string): string | null {
  if (process.platform === 'win32') {
    try {
      const paths = execFileSync(getWhereExePath(), [command], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
      return filterOutCwdPaths(paths)[0] || null
    } catch {
      return null
    }
  }

  try {
    const result = execSync_DEPRECATED(`which ${command}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return result.toString().trim() || null
  } catch {
    return null
  }
}

const bunWhich =
  typeof Bun !== 'undefined' && typeof Bun.which === 'function'
    ? Bun.which
    : null

/** Bun.which with the same cwd filtering as the where.exe paths on Windows. */
function bunWhichSafe(command: string): string | null {
  const result = bunWhich!(command)
  if (!result || process.platform !== 'win32') return result
  return filterOutCwdPaths([result])[0] ?? null
}

/**
 * Finds the full path to a command executable.
 * Uses Bun.which when running in Bun (fast, no process spawn),
 * otherwise spawns the platform-appropriate command.
 *
 * @param command - The command name to look up
 * @returns The full path to the command, or null if not found
 */
export const which: (command: string) => Promise<string | null> = bunWhich
  ? async command => bunWhichSafe(command)
  : whichNodeAsync

/**
 * Synchronous version of `which`.
 *
 * @param command - The command name to look up
 * @returns The full path to the command, or null if not found
 */
export const whichSync: (command: string) => string | null = bunWhich
  ? bunWhichSafe
  : whichNodeSync
