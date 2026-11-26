// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type Terminal = { type: 'terminal'; reason: string }
export type Continue = { type: 'continue' }

// Reasons queryLoop returns with (reported to SDK consumers as terminal_reason)
export const TERMINAL_REASONS = [
  'blocking_limit',
  'rapid_refill_breaker',
  'prompt_too_long',
  'image_error',
  'model_error',
  'aborted_streaming',
  'aborted_tools',
  'stop_hook_prevented',
  'hook_stopped',
  'tool_deferred',
  'max_turns',
  'completed',
] as const

export type TerminalReason = (typeof TERMINAL_REASONS)[number]
