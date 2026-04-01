// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type QueueOperation = 'enqueue' | 'dequeue' | 'dequeue_all' | 'clear' | 'pause' | 'resume'
export type QueueOperationMessage = { type: 'queue-operation'; operation: QueueOperation; timestamp: string; sessionId: string; content?: string }
