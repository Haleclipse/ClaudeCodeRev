// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type LspServerConfig = {
  command: string; args?: string[]
  initializationOptions?: Record<string, unknown>
  extensionToLanguage: Record<string, string>
  [key: string]: unknown
}
export type ScopedLspServerConfig = LspServerConfig & { serverName?: string }
export type LspServerState = 'idle' | 'initializing' | 'running' | 'error' | 'stopped'
