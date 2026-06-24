/**
 * Generate stub files for source modules missing from the sourcemap.
 *
 * These 159 files existed in the original monorepo but were eliminated by
 * Bun's dead-code elimination (feature flags / build-time gates) and thus
 * never entered cli.js or cli.js.map.
 *
 * This script scans the restored source for imports that point to
 * non-existent .ts/.tsx files, infers minimal exports from usage, and
 * writes stub files so that `bun run dev` and `tsc --noEmit` can succeed.
 *
 * Usage:
 *   bun run scripts/gen-stubs.ts            # generate stubs
 *   bun run scripts/gen-stubs.ts --dry-run  # preview only
 *   bun run scripts/gen-stubs.ts --clean    # remove generated stubs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname, normalize } from 'path'

const ROOT = join(import.meta.dir, '..', 'src')
const STUB_MARKER = '// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts'
const DRY_RUN = process.argv.includes('--dry-run')
const CLEAN = process.argv.includes('--clean')

// ---------------------------------------------------------------------------
// 1. Walk source tree
// ---------------------------------------------------------------------------
function walk(dir: string): string[] {
  const { readdirSync } = require('fs')
  const files: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

// ---------------------------------------------------------------------------
// 2. Collect missing targets + what symbols are imported from them
// ---------------------------------------------------------------------------
type ImportInfo = {
  symbol: string
  isType: boolean  // import type { X } or { type X }
}

const missingTargets = new Map<string, ImportInfo[]>()

const allFiles = walk(ROOT).filter(f => /\.(ts|tsx)$/.test(f))

for (const file of allFiles) {
  const content = readFileSync(file, 'utf8')
  const dir = dirname(file)

  // Match import/export statements with 'from' clause:
  //   import { A, type B } from './foo.js'
  //   import type { C } from '../bar.js'
  //   import X from 'src/baz.js'
  //   export { D } from './bar.js'
  //   export type { E } from './bar.js'
  //   export * from './baz.js'
  const staticRe = /^((?:import|export)\s+(?:type\s+)?)((?:\*|\{[^}]*\}|[\w$]+)(?:\s*,\s*(?:\{[^}]*\}|[\w$]+))*)\s+from\s+['"]([^'"]+\.js)['"]/gm

  let m: RegExpExecArray | null
  while ((m = staticRe.exec(content)) !== null) {
    const prefix = m[1]        // "import ", "import type ", "export ", "export type "
    const symbolsPart = m[2]   // "{ Foo, type Bar }", "Default", "*"
    const specifier = m[3]     // "./types/message.js" or "src/types/message.js"

    // Resolve to absolute path
    let resolved: string
    if (specifier.startsWith('src/')) {
      resolved = join(ROOT, specifier.replace(/^src\//, ''))
    } else if (specifier.startsWith('.')) {
      resolved = normalize(join(dir, specifier))
    } else {
      continue // external package
    }

    // Check if target exists
    const tsPath = resolved.replace(/\.js$/, '.ts')
    const tsxPath = resolved.replace(/\.js$/, '.tsx')
    if (existsSync(tsPath) || existsSync(tsxPath)) continue

    // Parse symbols
    const isEntirelyType = prefix.includes('type')
    const symbols: ImportInfo[] = []

    if (symbolsPart === '*') {
      // export * from — no named symbols, just ensure file exists
      // (no symbols to add, but file must be registered)
    } else if (symbolsPart.startsWith('{')) {
      // Named imports/exports: { A, type B, C as D }
      const inner = symbolsPart.slice(1, -1)
      for (const part of inner.split(',')) {
        const trimmed = part.trim()
        if (!trimmed) continue
        const isTypeMember = trimmed.startsWith('type ')
        const name = trimmed
          .replace(/^type\s+/, '')
          .replace(/\s+as\s+\w+$/, '')
          .trim()
        symbols.push({ symbol: name, isType: isEntirelyType || isTypeMember })
      }
    } else {
      // Default import
      symbols.push({ symbol: 'default', isType: isEntirelyType })
    }

    const key = tsPath // normalize to .ts
    const existing = missingTargets.get(key) ?? []
    existing.push(...symbols)
    missingTargets.set(key, existing)
  }

  // Handle bare side-effect imports: import './foo.d.ts', import '../bar.js'
  const bareRe = /^import\s+['"](\.[^'"]+)['"]/gm
  while ((m = bareRe.exec(content)) !== null) {
    const specifier = m[1]
    const resolved = normalize(join(dir, specifier))
    // For .d.ts files, check as-is; for .js, check .ts/.tsx
    if (specifier.endsWith('.d.ts')) {
      if (!existsSync(resolved)) {
        if (!missingTargets.has(resolved)) missingTargets.set(resolved, [])
      }
    } else if (specifier.endsWith('.js')) {
      const tsPath = resolved.replace(/\.js$/, '.ts')
      const tsxPath = resolved.replace(/\.js$/, '.tsx')
      if (!existsSync(tsPath) && !existsSync(tsxPath)) {
        if (!missingTargets.has(tsPath)) missingTargets.set(tsPath, [])
      }
    }
  }

  // Also handle dynamic imports: import('...')
  const dynRe = /import\(\s*['"]([^'"]+\.js)['"]\s*\)/g
  while ((m = dynRe.exec(content)) !== null) {
    const specifier = m[1]
    let resolved: string
    if (specifier.startsWith('src/')) {
      resolved = join(ROOT, specifier.replace(/^src\//, ''))
    } else if (specifier.startsWith('.')) {
      resolved = normalize(join(dir, specifier))
    } else continue

    const tsPath = resolved.replace(/\.js$/, '.ts')
    const tsxPath = resolved.replace(/\.js$/, '.tsx')
    if (existsSync(tsPath) || existsSync(tsxPath)) continue

    const key = tsPath
    if (!missingTargets.has(key)) {
      missingTargets.set(key, [])
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Known type definitions — inferred from codebase usage patterns
//
// For core type files that are heavily imported, we provide proper type
// definitions instead of `any`. These were reverse-engineered from property
// access patterns, discriminant checks, and SDK type relationships.
// ---------------------------------------------------------------------------
const KNOWN_DEFINITIONS: Record<string, string> = {}

// Helper: register a known definition by relative path (from src/)
function known(relPath: string, content: string) {
  KNOWN_DEFINITIONS[join(ROOT, relPath)] = `${STUB_MARKER}
// Type definitions inferred from codebase usage patterns

${content.trim()}
`
}

// --- types/message.ts ---
known('types/message.ts', `
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
`)

// --- types/tools.ts ---
known('types/tools.ts', `
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
`)

// --- types/connectorText.ts ---
known('types/connectorText.ts', `
export type ConnectorTextBlock = {
  type: 'connector_text'
  connector_text: string
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
}

export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return typeof block === 'object' && block !== null && 'type' in block && (block as any).type === 'connector_text'
}
`)

// --- types/utils.ts ---
known('types/utils.ts', `
export type DeepImmutable<T> = T extends (...args: any[]) => any ? T : T extends object ? { readonly [K in keyof T]: DeepImmutable<T[K]> } : T
export type Permutations<T extends string> = T extends \`\${infer F}\${infer R}\` ? F | Permutations<R> | \`\${F}\${Permutations<R>}\` : ''
`)

// --- types/notebook.ts ---
known('types/notebook.ts', `
export type NotebookCellType = 'code' | 'markdown'

export type NotebookCellOutput =
  | { output_type: 'stream'; name?: string; text: string | string[] }
  | { output_type: 'display_data' | 'execute_result'; data?: Record<string, unknown>; metadata?: Record<string, unknown> }
  | { output_type: 'error'; ename: string; evalue: string; traceback: string[] }

export type NotebookOutputImage = { image_data: string; media_type: 'image/png' | 'image/jpeg' }

export type NotebookCellSourceOutput = { output_type: string; text?: string; image?: NotebookOutputImage }

export type NotebookCellSource = {
  cellType: NotebookCellType; source: string; execution_count?: number
  cell_id: string; language?: string; outputs?: NotebookCellSourceOutput[]
}

export type NotebookCell = {
  id?: string; cell_type: NotebookCellType; source: string | string[]
  execution_count?: number | null; outputs?: NotebookCellOutput[]; metadata?: Record<string, unknown>
}

export type NotebookContent = {
  cells: NotebookCell[]
  metadata: { language_info?: { name: string }; [key: string]: unknown }
  nbformat: number; nbformat_minor: number
}
`)

// --- types/messageQueueTypes.ts ---
known('types/messageQueueTypes.ts', `
export type QueueOperation = 'enqueue' | 'dequeue' | 'dequeue_all' | 'clear' | 'pause' | 'resume'
export type QueueOperationMessage = { type: 'queue-operation'; operation: QueueOperation; timestamp: string; sessionId: string; content?: string }
`)

// --- types/statusLine.ts ---
known('types/statusLine.ts', `
export type StatusLineCommandInput = { context: 'default' }
`)

// --- types/fileSuggestion.ts ---
known('types/fileSuggestion.ts', `
export type FileSuggestionCommandInput = { context: 'default' }
`)

// --- constants/querySource.ts ---
known('constants/querySource.ts', `
export type QuerySource = 'cli' | 'sdk' | 'bridge' | 'browser' | 'api' | 'webhook' | 'skill' | 'agent' | 'unknown'
`)

// --- services/oauth/types.ts ---
known('services/oauth/types.ts', `
export type BillingType = 'free' | 'pro' | 'team' | 'enterprise'
export type SubscriptionType = 'free' | 'pro' | 'team' | 'enterprise'
export type RateLimitTier = 'free' | 'pro' | 'enterprise'

export type OAuthTokens = {
  accessToken: string; refreshToken?: string; expiresAt?: number; tokenType?: string
  scopes?: string[]; subscriptionType?: SubscriptionType; billingType?: BillingType
  rateLimitTier?: RateLimitTier; accountUuid?: string; organizationId?: string
  organizationName?: string; email?: string
}

export type OAuthProfileResponse = {
  id: string; email: string; name: string; accountUuid: string
  subscriptionType: SubscriptionType; billingType: BillingType; rateLimitTier: RateLimitTier
  organizationId?: string; organizationName?: string; [key: string]: unknown
}

export type OAuthTokenExchangeResponse = { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }

export type ReferralEligibilityResponse = { eligible: boolean; reason?: string }
export type ReferrerRewardInfo = { amount?: number; currency?: string }
export type ReferralRedemptionsResponse = { redemptions: unknown[] }
export type ReferralCampaign = { id: string; name: string; active: boolean }
export type UserRolesResponse = { roles: string[] }
`)

// --- entrypoints/sdk/controlTypes.ts ---
known('entrypoints/sdk/controlTypes.ts', `
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
`)

// --- keybindings/types.ts ---
known('keybindings/types.ts', `
export type ParsedKeystroke = { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }
export type Chord = ParsedKeystroke[]
export type KeybindingAction = string
export type ParsedBinding = { chord: Chord; action: KeybindingAction; context?: KeybindingContextName }
export type KeybindingBlock = { context?: KeybindingContextName; bindings: Record<string, KeybindingAction> }
export type KeybindingContextName = 'default' | 'vim-normal' | 'vim-insert' | 'vim-visual' | string
`)

// --- services/lsp/types.ts ---
known('services/lsp/types.ts', `
export type LspServerConfig = {
  command: string; args?: string[]
  initializationOptions?: Record<string, unknown>
  extensionToLanguage: Record<string, string>
  [key: string]: unknown
}
export type ScopedLspServerConfig = LspServerConfig & { serverName?: string }
export type LspServerState = 'idle' | 'initializing' | 'running' | 'error' | 'stopped'
`)

// --- entrypoints/sdk/runtimeTypes.ts ---
known('entrypoints/sdk/runtimeTypes.ts', `
export type EffortLevel = 'low' | 'medium' | 'high'
export type AnyZodRawShape = Record<string, unknown>
export type InferShape<T> = T
export type NonNullableUsage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
export type ForkSessionOptions = { sessionId: string }
export type ForkSessionResult = { sessionId: string }
export type GetSessionInfoOptions = { sessionId: string }
export type GetSessionMessagesOptions = { sessionId: string }
export type ListSessionsOptions = Record<string, unknown>
export type McpSdkServerConfigWithInstance = Record<string, unknown>
export type SdkMcpToolDefinition = { name: string; description?: string; inputSchema?: unknown }
export type SessionMessage = Record<string, unknown>
export type SessionMutationOptions = Record<string, unknown>
export type SDKSession = Record<string, unknown>
export type SDKSessionOptions = Record<string, unknown>
export type InternalOptions = Record<string, unknown>
export type InternalQuery = Record<string, unknown>
export type Options = Record<string, unknown>
export type Query = Record<string, unknown>
`)

// --- entrypoints/sdk/sdkUtilityTypes.ts ---
known('entrypoints/sdk/sdkUtilityTypes.ts', `
export type NonNullableUsage = {
  input_tokens: number; output_tokens: number
  cache_creation_input_tokens?: number; cache_read_input_tokens?: number
  server_tool_use_input_tokens?: number
  [key: string]: number | undefined
}
`)

// --- entrypoints/sdk/coreTypes.generated.ts ---
known('entrypoints/sdk/coreTypes.generated.ts', `
export {}
`)

// --- entrypoints/sdk/settingsTypes.generated.ts ---
known('entrypoints/sdk/settingsTypes.generated.ts', `
export {}
`)

// --- entrypoints/sdk/toolTypes.ts ---
known('entrypoints/sdk/toolTypes.ts', `
export {}
`)

// --- components/Spinner/types.ts ---
known('components/Spinner/types.ts', `
export type SpinnerMode = 'loading' | 'responding' | 'tool' | 'compact' | 'thinking' | 'idle'
export type RGBColor = { r: number; g: number; b: number }
`)

// --- components/mcp/types.ts ---
known('components/mcp/types.ts', `
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
`)

// --- components/wizard/types.ts ---
known('components/wizard/types.ts', `
export type WizardStepComponent<T = any> = React.ComponentType<{ data: T; onNext: (data: Partial<T>) => void; onBack: () => void }>
export type WizardContextValue<T = any> = {
  data: T; step: number; totalSteps: number
  next: (data?: Partial<T>) => void; back: () => void; cancel: () => void
  goNext: (data?: Partial<T>) => void; goBack: () => void
  updateWizardData: (data: Partial<T>) => void; wizardData: T
  currentStep: number
}
export type WizardProviderProps<T = any> = { children: React.ReactNode; initialData: T; onComplete: (data: T) => void; onCancel?: () => void }
`)

// --- components/agents/new-agent-creation/types.ts ---
known('components/agents/new-agent-creation/types.ts', `
export type AgentWizardData = {
  name?: string; description?: string; prompt?: string; model?: string
  color?: string; location?: string; method?: string; type?: string
  tools?: string[]; memory?: string | false
  systemPrompt?: string; finalAgent?: any
  effort?: string; permissionMode?: string
}
`)

// --- commands/install-github-app/types.ts ---
known('commands/install-github-app/types.ts', `
export type Workflow = { name: string; path: string; content: string }
export type Warning = { message: string; severity: 'info' | 'warning' | 'error' }
export type State = { step: number; workflows: Workflow[]; warnings: Warning[] }
`)

// --- commands/plugin/types.ts ---
known('commands/plugin/types.ts', `
export type ViewState = 'list' | 'detail' | 'settings' | 'marketplace' | 'add'
export type PluginSettingsProps = { onBack: () => void }
`)

// --- services/tips/types.ts ---
known('services/tips/types.ts', `
export type TipContext = { sessionCount: number; toolUsage: Record<string, number>; features: Record<string, boolean> }
export type Tip = { id: string; message: string; priority: number; condition?: (ctx: TipContext) => boolean }
`)

// --- utils/secureStorage/types.ts ---
known('utils/secureStorage/types.ts', `
export type SecureStorageData = Record<string, unknown>
export type SecureStorage = {
  read(): SecureStorageData
  readAsync(): Promise<SecureStorageData | null>
  update(data: SecureStorageData): { success: boolean; warning?: string }
  delete(): boolean
}
`)

// --- utils/filePersistence/types.ts ---
known('utils/filePersistence/types.ts', `
export type TurnStartTime = number
export type FailedPersistence = { path: string; error: string }
export type PersistedFile = { path: string; hash: string; size: number }
export type FilesPersistedEventData = { files: PersistedFile[]; failed: FailedPersistence[] }
export const DEFAULT_UPLOAD_CONCURRENCY = 5
export const FILE_COUNT_LIMIT = 100
export const OUTPUTS_SUBDIR = 'outputs'
`)

// --- commands/plugin/unifiedTypes.ts ---
known('commands/plugin/unifiedTypes.ts', `
export type UnifiedInstalledItem = { name: string; type: 'plugin' | 'mcp'; enabled: boolean; source?: string; scope?: string; version?: string }
`)

// --- components/ui/option.ts ---
known('components/ui/option.ts', `
export type Option<T = string> = { label: string; value: T; description?: string; disabled?: boolean }
`)

// --- services/skillSearch/signals.ts ---
known('services/skillSearch/signals.ts', `
export type DiscoverySignal = { type: string; query?: string; context?: string }
`)

// --- components/FeedbackSurvey/utils.ts ---
known('components/FeedbackSurvey/utils.ts', `
export type FeedbackSurveyType = 'general' | 'post_compact' | 'memory' | 'skill_improvement'
export type FeedbackSurveyResponse = { type: FeedbackSurveyType; rating?: number; comment?: string; sessionId?: string }
`)

// --- query/transitions.ts ---
known('query/transitions.ts', `
export type Terminal = { type: 'terminal'; reason: string }
export type Continue = { type: 'continue' }
`)

// --- ink/global.d.ts ---
// JSX IntrinsicElements for custom Ink renderer (imported as '../global.d.ts')
known('ink/global.d.ts', `
type InkElementProps = {
  ref?: any; key?: string | number; children?: any
  tabIndex?: number; autoFocus?: boolean
  style?: Record<string, unknown>
  textStyles?: Record<string, unknown>
  onClick?: (event: any) => void
  onFocus?: (event: any) => void
  onFocusCapture?: (event: any) => void
  onBlur?: (event: any) => void
  onBlurCapture?: (event: any) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onKeyDown?: (event: any) => void
  onKeyDownCapture?: (event: any) => void
  [key: string]: any
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ink-root': InkElementProps
      'ink-box': InkElementProps
      'ink-text': InkElementProps
      'ink-virtual-text': InkElementProps
      'ink-link': InkElementProps & { href?: string }
      'ink-progress': InkElementProps
      'ink-raw-ansi': InkElementProps & { rawText?: string; rawWidth?: number; rawHeight?: number }
    }
  }
}

export {}
`)

// --- ink/cursor.ts ---
known('ink/cursor.ts', `
export type Cursor = { x: number; y: number; visible: boolean }
`)

// --- ink/events/paste-event.ts ---
known('ink/events/paste-event.ts', `
export type PasteEvent = { text: string }
`)

// --- ink/events/resize-event.ts ---
known('ink/events/resize-event.ts', `
export type ResizeEvent = { columns: number; rows: number }
`)

// --- cli/transports/Transport.ts ---
known('cli/transports/Transport.ts', `
export type Transport = { send(data: unknown): void; close(): void; onMessage(handler: (data: unknown) => void): void }
`)

// --- ssh types ---
known('ssh/createSSHSession.ts', `
export type SSHSession = { id: string; host: string; port: number; close(): Promise<void> }
`)
known('ssh/SSHSessionManager.ts', `
export type SSHSessionManager = { create(host: string, port: number): Promise<unknown>; close(id: string): Promise<void>; list(): unknown[] }
`)

// --- task types ---
known('tasks/LocalWorkflowTask/LocalWorkflowTask.ts', `
export type LocalWorkflowTaskState = { status: 'pending' | 'running' | 'completed' | 'failed'; workflowName?: string }
`)
known('tasks/MonitorMcpTask/MonitorMcpTask.ts', `
export type MonitorMcpTaskState = { status: 'pending' | 'running' | 'completed' | 'failed'; serverName?: string }
`)

// --- assistant types ---
known('assistant/sessionDiscovery.ts', `
export type AssistantSession = { id: string; name?: string; createdAt: string }
`)

// ---------------------------------------------------------------------------
// 3. Generate stub content
// ---------------------------------------------------------------------------
function generateStub(targetPath: string, imports: ImportInfo[]): string {
  // Use known definition if available
  if (KNOWN_DEFINITIONS[targetPath]) {
    return KNOWN_DEFINITIONS[targetPath]
  }

  // Deduplicate symbols
  const seen = new Map<string, boolean>() // symbol → isType (false wins, i.e. value)
  for (const { symbol, isType } of imports) {
    const existing = seen.get(symbol)
    if (existing === undefined) {
      seen.set(symbol, isType)
    } else if (existing && !isType) {
      seen.set(symbol, false) // upgrade to value export
    }
  }

  const lines: string[] = [STUB_MARKER, '']

  const typeExports: string[] = []
  const valueExports: string[] = []

  for (const [symbol, isType] of seen) {
    if (symbol === 'default') {
      valueExports.push('export default {} as any')
    } else if (isType) {
      typeExports.push(symbol)
    } else {
      valueExports.push(`export const ${symbol}: any = undefined`)
    }
  }

  if (typeExports.length > 0) {
    for (const t of typeExports) {
      lines.push(`export type ${t} = any`)
    }
  }

  if (valueExports.length > 0) {
    if (typeExports.length > 0) lines.push('')
    for (const v of valueExports) {
      lines.push(v)
    }
  }

  // If nothing was imported (dynamic import only), export empty
  if (seen.size === 0) {
    lines.push('export {}')
  }

  lines.push('') // trailing newline
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 4. Write or clean
// ---------------------------------------------------------------------------
if (CLEAN) {
  let removed = 0
  for (const [target] of missingTargets) {
    if (existsSync(target)) {
      const content = readFileSync(target, 'utf8')
      if (content.startsWith(STUB_MARKER)) {
        unlinkSync(target)
        removed++
      }
    }
  }
  // Also scan for any remaining stubs
  for (const f of walk(ROOT)) {
    if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      try {
        const content = readFileSync(f, 'utf8')
        if (content.startsWith(STUB_MARKER)) {
          unlinkSync(f)
          removed++
        }
      } catch {}
    }
  }
  console.log(`Removed ${removed} stub files`)
  process.exit(0)
}

const sorted = [...missingTargets.entries()].sort((a, b) => a[0].localeCompare(b[0]))

let created = 0
let skipped = 0

for (const [target, imports] of sorted) {
  const stub = generateStub(target, imports)
  const rel = target.replace(ROOT + '/', '')

  if (DRY_RUN) {
    const symbols = [...new Set(imports.map(i => (i.isType ? 'type ' : '') + i.symbol))]
    console.log(`${rel}  →  ${symbols.join(', ') || '(dynamic import)'}`)
    created++
    continue
  }

  // Skip if file already exists and is not a stub
  if (existsSync(target)) {
    const existing = readFileSync(target, 'utf8')
    if (!existing.startsWith(STUB_MARKER)) {
      skipped++
      continue
    }
  }

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, stub)
  created++
}

if (DRY_RUN) {
  console.log(`\n${created} stub files would be created`)
} else {
  console.log(`Created ${created} stubs, skipped ${skipped} existing files`)
}
