/**
 * Linux native (bundled) builds embed the apply-seccomp helper in the
 * executable itself. /proc/self/exe is opened once and handed to sandboxed
 * children on a fixed fd, and sandbox-runtime invokes the helper through it.
 */

import { open } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import { isInBundledMode } from '../bundledMode.js'
import { logForDebugging } from '../debug.js'

/** fd the sandboxed child receives the executable on. */
export const APPLY_SECCOMP_FD = 3

function isEmbeddedSeccompEnabled(): boolean {
  return process.platform === 'linux' && isInBundledMode()
}

export async function getApplySeccompFd(): Promise<number | undefined> {
  return (await openSelfExecutable())?.fd
}

export function getEmbeddedSeccompConfig():
  | { applyPath: string; argv0: string }
  | undefined {
  if (!isEmbeddedSeccompEnabled()) return
  return {
    applyPath: `/proc/self/fd/${APPLY_SECCOMP_FD}`,
    argv0: 'apply-seccomp',
  }
}

const openSelfExecutable = memoize(async () => {
  if (!isEmbeddedSeccompEnabled()) return
  try {
    return await open('/proc/self/exe', 'r')
  } catch (error) {
    logForDebugging(`seccomp: failed to open /proc/self/exe: ${error}`)
    return
  }
})
