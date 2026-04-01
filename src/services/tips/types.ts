// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type TipContext = { sessionCount: number; toolUsage: Record<string, number>; features: Record<string, boolean> }
export type Tip = { id: string; message: string; priority: number; condition?: (ctx: TipContext) => boolean }
