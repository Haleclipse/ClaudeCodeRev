// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type SSHSessionManager = { create(host: string, port: number): Promise<unknown>; close(id: string): Promise<void>; list(): unknown[] }
