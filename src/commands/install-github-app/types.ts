// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type Workflow = { name: string; path: string; content: string }
export type Warning = { message: string; severity: 'info' | 'warning' | 'error' }
export type State = { step: number; workflows: Workflow[]; warnings: Warning[] }
