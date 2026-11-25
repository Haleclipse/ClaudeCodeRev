import {
  type ExecaReturnValue,
  type ExecaSyncReturnValue,
  execa,
  execaSync,
  type Options,
  type SyncOptions,
} from 'execa'
import { resolveWindowsExecutable } from './windowsExecutable.js'

function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * `execa(file, args)` that never runs an executable from the current
 * directory on Windows (see resolveWindowsExecutable). Throws when the
 * command only resolves to an unsafe location.
 */
export async function execaSafe(
  file: string,
  args: readonly string[] = [],
  options?: Options,
): Promise<ExecaReturnValue> {
  if (isWindows()) {
    const resolved = resolveWindowsExecutable(file)
    if (resolved === null) {
      throw new Error(
        `Command '${file}' not found or is in an unsafe location (current directory)`,
      )
    }
    return execa(resolved, args, options)
  }
  return execa(file, args, options)
}

/** Synchronous execaSafe. */
export function execaSyncSafe(
  file: string,
  args: readonly string[] = [],
  options?: SyncOptions,
): ExecaSyncReturnValue {
  if (isWindows()) {
    const resolved = resolveWindowsExecutable(file)
    if (resolved === null) {
      throw new Error(
        `Command '${file}' not found or is in an unsafe location (current directory)`,
      )
    }
    return execaSync(resolved, args, options)
  }
  return execaSync(file, args, options)
}

/**
 * Run a shell command line (`shell: true`). The shell does its own command
 * lookup, so there is no executable to pre-resolve here.
 */
export async function execaShell(
  command: string,
  options?: Options,
): Promise<ExecaReturnValue> {
  return execa(command, { ...options, shell: true })
}

/** Synchronous execaShell. */
export function execaShellSync(
  command: string,
  options?: SyncOptions,
): ExecaSyncReturnValue {
  return execaSync(command, { ...options, shell: true })
}
