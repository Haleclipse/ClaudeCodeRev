// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type BashProgress = {
  fullOutput: string; output: string; elapsedTimeSeconds: number
  totalLines: number; totalBytes: number; timeoutMs: number; taskId: string
}
export type PowerShellProgress = { status: 'completed' | 'failed' | 'killed' | 'running' | 'pending'; taskId?: string }
export type ShellProgress = { status: 'completed' | 'failed' | 'killed' | 'running' | 'pending'; taskId?: string }
export type MCPProgress = { progress?: number; total?: number; progressMessage?: string }
export type WebSearchProgress = { status?: string }
export type REPLToolProgress = { status?: string; output?: string }
export type AgentToolProgress = { agentId?: string; status?: string; message?: any }
export type SkillToolProgress = { skillName?: string; status?: string }
export type TaskOutputProgress = { taskId: string; status?: string }
export type SdkWorkflowProgress = { toolName: string; status?: string; progress?: number; total?: number }
export type ToolProgressData =
  | { type: 'bash'; data: BashProgress }
  | { type: 'mcp'; data: MCPProgress }
  | { type: 'web_search'; data: WebSearchProgress }
  | { type: 'repl'; data: REPLToolProgress }
  | { type: 'agent'; data: AgentToolProgress }
  | { type: 'skill'; data: SkillToolProgress }
  | { type: 'task_output'; data: TaskOutputProgress }
  | { type: 'shell'; data: ShellProgress }
  | { type: 'powershell'; data: PowerShellProgress }
  | { type: 'workflow'; data: SdkWorkflowProgress }
