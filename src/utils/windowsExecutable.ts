import { execFileSync } from 'child_process'
import { dirname, join, resolve, sep } from 'path'

function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Find an executable on Windows via where.exe, skipping any result inside the
 * current working directory.
 *
 * SECURITY: Windows resolves bare command names against the current directory
 * before PATH, so a repository can plant `git.bat` / `rg.exe` next to the
 * user's files and have it run instead of the real tool. where.exe itself is
 * invoked by absolute path (System32) for the same reason.
 *
 * @returns The first matching path outside the cwd, or null if none
 */
export function findWindowsExecutable(name: string): string | null {
  const systemRoot = process.env.SYSTEMROOT || 'C:\\Windows'
  const whereExe = join(systemRoot, 'System32', 'where.exe')
  try {
    const paths = execFileSync(whereExe, [name], {
      stdio: 'pipe',
      encoding: 'utf8',
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
    const cwd = process.cwd().toLowerCase()
    for (const candidate of paths) {
      const normalized = resolve(candidate).toLowerCase()
      if (
        dirname(normalized).toLowerCase() === cwd ||
        normalized.startsWith(cwd + sep)
      ) {
        continue
      }
      return candidate
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolve a command name to the executable that is safe to spawn. Off Windows,
 * or when the command is already a path, it is returned unchanged. On Windows
 * a bare name is resolved via findWindowsExecutable — null means only an
 * unsafe (cwd) match exists, or none at all.
 */
export function resolveWindowsExecutable(name: string): string | null {
  if (!isWindows()) return name
  if (name.includes('/') || name.includes('\\')) return name
  return findWindowsExecutable(name)
}
