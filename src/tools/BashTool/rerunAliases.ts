import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'

/**
 * Session-scoped aliases (b1, b2, …) for executed Bash commands, so the model
 * can rerun a previous command verbatim with {rerun: 'bN'}.
 */
export type RerunAliasTable = {
  map: Map<string, string>
  nextId: number
}

export function createRerunAliasTable(): RerunAliasTable {
  return { map: new Map(), nextId: 1 }
}

export function isRerunAliasEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_velvet_anchor', false)
}

export function registerRerunAlias(
  table: RerunAliasTable,
  command: string,
): string {
  const alias = `b${table.nextId++}`
  table.map.set(alias, command)
  return alias
}

export function resolveRerunAlias(
  table: RerunAliasTable | undefined,
  alias: string,
): { command?: string; error?: string } {
  const command = table?.map.get(alias)
  if (command !== undefined) {
    return { command }
  }
  const known = table ? Array.from(table.map.keys()) : []
  const list = known.length > 0 ? known.join(', ') : 'none'
  return {
    error: `Unknown rerun alias '${alias}'. Valid aliases this session: ${list}. Provide {command: "..."} instead.`,
  }
}

export function formatRerunMarker(alias: string): string {
  return `[rerun: ${alias}]`
}
