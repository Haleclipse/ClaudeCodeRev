// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type SDKControlInitializeRequest = { subtype: 'initialize'; [key: string]: unknown }
export type SDKControlInitializeResponse = { type: 'control_response'; [key: string]: unknown }
export type SDKControlCancelRequest = { subtype: 'interrupt' }
export type SDKControlMcpSetServersResponse = { type: 'control_response'; mcpServers?: unknown[] }
export type SDKControlReloadPluginsResponse = { type: 'control_response' }
export type SDKControlPermissionRequest = { subtype: 'can_use_tool'; tool_name: string; tool_use_id: string; input: Record<string, unknown>; [key: string]: unknown }
export type SDKPartialAssistantMessage = { type: 'partial_assistant'; content?: unknown[] }
export type SDKControlRequestInner = { subtype: string; [key: string]: unknown }
export type SDKControlRequest = SDKControlRequestInner
export type SDKControlResponse = { type: 'control_response'; requestId?: string; [key: string]: unknown }

export type StdoutMessage =
  | { type: 'text'; content: string; timestamp?: number }
  | { type: 'json'; content: Record<string, unknown>; timestamp?: number }
  | { type: 'event'; event: Record<string, unknown>; timestamp?: number }
  | { type: 'control_request'; request: SDKControlRequest; requestId: string }
  | { type: 'control_response'; response: SDKControlResponse; requestId: string }

export type StdinMessage = { type: 'stdin'; content: string } | { type: 'control_response'; response: SDKControlResponse; requestId: string }
