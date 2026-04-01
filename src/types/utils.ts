// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type DeepImmutable<T> = T extends (...args: any[]) => any ? T : T extends object ? { readonly [K in keyof T]: DeepImmutable<T[K]> } : T
export type Permutations<T extends string> = T extends `${infer F}${infer R}` ? F | Permutations<R> | `${F}${Permutations<R>}` : ''
