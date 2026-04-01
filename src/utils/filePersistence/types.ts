// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type TurnStartTime = number
export type FailedPersistence = { path: string; error: string }
export type PersistedFile = { path: string; hash: string; size: number }
export type FilesPersistedEventData = { files: PersistedFile[]; failed: FailedPersistence[] }
export const DEFAULT_UPLOAD_CONCURRENCY = 5
export const FILE_COUNT_LIMIT = 100
export const OUTPUTS_SUBDIR = 'outputs'
