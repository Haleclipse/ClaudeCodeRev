// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

import type { BetaContentBlock, BetaMessage, BetaUsage, ContentBlockParam, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/beta/index.js'

export type MessageOrigin = 'keyboard' | 'SendUserMessage' | 'queue' | 'hook' | 'agent' | string

export type SystemMessageLevel = 'info' | 'warning' | 'suggestion'

export type CompactMetadata = {
  messagesSummarized?: number
  userContext?: string
  direction?: 'forward' | 'backward'
  preservedSegment?: unknown
  trigger?: string
  preTokens?: number
  preCompactDiscoveredTools?: string[]
}

export type StopHookInfo = {
  hookName: string
  output?: string
  error?: string
  durationMs?: number
  preventedContinuation?: boolean
}

// --- Base fields shared by all messages ---
type MessageBase = {
  uuid: string
  timestamp: string
  isMeta?: boolean
  isVirtual?: boolean
}

// --- AssistantMessage ---
export type AssistantMessage = MessageBase & {
  type: 'assistant'
  message: BetaMessage
  requestId?: string
  isApiErrorMessage?: boolean
  apiError?: unknown
  error?: unknown
  errorDetails?: string
  advisorModel?: string
  costUSD?: number
}

// --- UserMessage ---
export type UserMessage = MessageBase & {
  type: 'user'
  message: { role: 'user'; content: string | ContentBlockParam[] }
  isVisibleInTranscriptOnly?: boolean
  isCompactSummary?: boolean
  toolUseResult?: unknown
  mcpMeta?: unknown
  imagePasteIds?: number[]
  sourceToolAssistantUUID?: string
  permissionMode?: string
  origin?: MessageOrigin
  summarizeMetadata?: CompactMetadata
}

// --- SystemMessage subtypes ---
type SystemMessageBase = MessageBase & { type: 'system'; isMeta: boolean }

export type SystemInformationalMessage = SystemMessageBase & {
  subtype: 'informational'
  content: string
  level: SystemMessageLevel
  toolUseID?: string
  preventContinuation?: boolean
}
export type SystemAPIErrorMessage = SystemMessageBase & { subtype: 'api_error'; content: string; level: SystemMessageLevel }
export type SystemLocalCommandMessage = SystemMessageBase & { subtype: 'local_command'; content: string; level: 'info' }
export type SystemPermissionRetryMessage = SystemMessageBase & { subtype: 'permission_retry'; content: string; commands: string[]; level: 'info' }
export type SystemBridgeStatusMessage = SystemMessageBase & { subtype: 'bridge_status'; content: string; url: string; upgradeNudge?: string }
export type SystemScheduledTaskFireMessage = SystemMessageBase & { subtype: 'scheduled_task_fire'; content: string }
export type SystemStopHookSummaryMessage = SystemMessageBase & {
  subtype: 'stop_hook_summary'
  hookCount: number; hookInfos: StopHookInfo[]; hookErrors: string[]
  preventedContinuation: boolean; stopReason: string; hasOutput: boolean
  level: SystemMessageLevel; toolUseID?: string; hookLabel?: string; totalDurationMs?: number
}
export type SystemTurnDurationMessage = SystemMessageBase & {
  subtype: 'turn_duration'; durationMs: number
  budgetTokens?: number; budgetLimit?: number; budgetNudges?: number; messageCount?: number
}
export type SystemAwaySummaryMessage = SystemMessageBase & { subtype: 'away_summary'; content: string }
export type SystemMemorySavedMessage = SystemMessageBase & { subtype: 'memory_saved'; writtenPaths: string[] }
export type SystemCompactBoundaryMessage = SystemMessageBase & { subtype: 'compact_boundary'; compactMetadata?: CompactMetadata & { preCompactDiscoveredTools?: string[] } }
export type SystemMicrocompactBoundaryMessage = SystemMessageBase & { subtype: 'microcompact_boundary'; microcompactMetadata?: unknown }
export type SystemAgentsKilledMessage = SystemMessageBase & { subtype: 'agents_killed' }
export type SystemApiMetricsMessage = SystemMessageBase & {
  subtype: 'api_metrics'
  ttftMs?: number; otps?: number; isP50?: boolean
  hookDurationMs?: number; turnDurationMs?: number; toolDurationMs?: number
  classifierDurationMs?: number; toolCount?: number; hookCount?: number
  classifierCount?: number; configWriteCount?: number
}
export type SystemFileSnapshotMessage = SystemMessageBase & { subtype: 'file_snapshot' }
export type SystemThinkingMessage = SystemMessageBase & { subtype: 'thinking' }

export type SystemMessage =
  | SystemInformationalMessage | SystemAPIErrorMessage | SystemLocalCommandMessage
  | SystemPermissionRetryMessage | SystemBridgeStatusMessage | SystemScheduledTaskFireMessage
  | SystemStopHookSummaryMessage | SystemTurnDurationMessage | SystemAwaySummaryMessage
  | SystemMemorySavedMessage | SystemCompactBoundaryMessage | SystemMicrocompactBoundaryMessage
  | SystemAgentsKilledMessage | SystemApiMetricsMessage | SystemFileSnapshotMessage
  | SystemThinkingMessage

// --- Other message types ---
export type AttachmentMessage = MessageBase & { type: 'attachment'; attachment: { type: string; [key: string]: unknown } }
export type ProgressMessage<P = unknown> = MessageBase & { type: 'progress'; data: P; toolUseID: string; parentToolUseID: string }
export type TombstoneMessage = MessageBase & { type: 'tombstone' }
export type ToolUseSummaryMessage = MessageBase & { type: 'tool_use_summary' }
export type StreamEvent = MessageBase & { type: 'stream'; event: unknown }
export type RequestStartEvent = MessageBase & { type: 'request_start' }
export type HookResultMessage = MessageBase & { type: 'hook_result'; attachment: unknown }

// --- Union ---
export type Message =
  | AssistantMessage | UserMessage | SystemMessage | AttachmentMessage
  | ProgressMessage | TombstoneMessage | ToolUseSummaryMessage
  | StreamEvent | RequestStartEvent | HookResultMessage

// --- Normalized variants ---
export type NormalizedAssistantMessage = AssistantMessage
export type NormalizedUserMessage = UserMessage
export type NormalizedMessage = Message

// --- Rendering ---
export type CollapsedReadSearchGroup = {
  type: 'collapsed_read_search'; messages: Message[]; uuid: string
  searchCount: number; readCount: number; listCount: number
  replCount?: number; memorySearchCount?: number; memoryReadCount?: number; memoryWriteCount?: number
  relevantMemories?: Array<{ path: string; content?: string }>
  hookInfos?: StopHookInfo[]
}
export type GroupedToolUseMessage = {
  type: 'grouped_tool_use'; messages: Message[]; uuid: string
  toolName: string; results: Array<{ message: Message; toolUseResult?: unknown }>
  hookInfos?: StopHookInfo[]
}
export type CollapsibleMessage = Message | CollapsedReadSearchGroup | GroupedToolUseMessage
export type RenderableMessage = Message | CollapsedReadSearchGroup | GroupedToolUseMessage

export type PartialCompactDirection = 'forward' | 'backward'
