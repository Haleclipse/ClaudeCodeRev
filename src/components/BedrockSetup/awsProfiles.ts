import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export async function readAwsProfileNames(): Promise<string[]> {
  const names = new Set<string>()
  const home = homedir()
  for (const { path, re } of [
    {
      path: join(home, '.aws', 'config'),
      re: /^\[(?:profile\s+)?([^\]]+)\]/gm,
    },
    { path: join(home, '.aws', 'credentials'), re: /^\[([^\]]+)\]/gm },
  ]) {
    try {
      for (const match of (await readFile(path, 'utf8')).matchAll(re)) {
        const name = match[1]?.trim()
        if (name && !name.startsWith('sso-session ')) names.add(name)
      }
    } catch {}
  }
  return [...names].sort()
}
