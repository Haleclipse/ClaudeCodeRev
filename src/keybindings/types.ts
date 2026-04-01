// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type ParsedKeystroke = { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }
export type Chord = ParsedKeystroke[]
export type KeybindingAction = string
export type ParsedBinding = { chord: Chord; action: KeybindingAction; context?: KeybindingContextName }
export type KeybindingBlock = { context?: KeybindingContextName; bindings: Record<string, KeybindingAction> }
export type KeybindingContextName = 'default' | 'vim-normal' | 'vim-insert' | 'vim-visual' | string
