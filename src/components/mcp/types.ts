// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type MCPViewState = 'list' | 'detail' | 'settings'
export type MCPClientState =
  | { type: 'connected'; tools: unknown[]; resources?: unknown[] }
  | { type: 'pending' }
  | { type: 'failed'; error: string }
  | { type: 'disabled' }
  | { type: 'needs-auth'; authUrl: string }
export type StdioServerInfo = { type: 'stdio'; name: string; command: string; args?: string[]; env?: Record<string, string>; config?: Record<string, unknown>; client: MCPClientState }
export type SSEServerInfo = { type: 'sse'; name: string; url: string; config?: Record<string, unknown>; client: MCPClientState }
export type HTTPServerInfo = { type: 'http'; name: string; url: string; config?: Record<string, unknown>; client: MCPClientState }
export type ClaudeAIServerInfo = { type: 'claude_ai'; name: string; id: string; config?: Record<string, unknown>; client: MCPClientState }
export type AgentMcpServerInfo = { type: 'agent'; name: string; config?: Record<string, unknown>; client: MCPClientState }
export type ServerInfo = StdioServerInfo | SSEServerInfo | HTTPServerInfo | ClaudeAIServerInfo | AgentMcpServerInfo
