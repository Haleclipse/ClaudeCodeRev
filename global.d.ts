/**
 * Build-time constants injected by scripts/build.ts via Bun's `define`.
 * At runtime these are replaced with string/boolean literals.
 */
declare const MACRO: {
  /** Package version, e.g. "2.1.88" */
  readonly VERSION: string
  /** ISO 8601 build timestamp */
  readonly BUILD_TIME: string
  /** npm package URL for this version */
  readonly PACKAGE_URL: string
  /** Native package URL (empty string if N/A) */
  readonly NATIVE_PACKAGE_URL: string
  /** Version changelog content */
  readonly VERSION_CHANGELOG: string
  /** User feedback channel URL */
  readonly FEEDBACK_CHANNEL: string
  /** Issues documentation URL */
  readonly ISSUES_EXPLAINER: string
}

/**
 * bun:bundle compile-time feature gate.
 * In the build output, feature() calls are replaced with boolean literals
 * and dead code is eliminated.
 */
declare module 'bun:bundle' {
  export function feature(name: string): boolean
}

/**
 * React Compiler runtime — the sourcemap-recovered code is post-compilation.
 * React Compiler rewrites components into memoized forms that import `c`
 * (cache slot allocator) from this module. Not reversible to pre-compiled form.
 */
declare module 'react/compiler-runtime' {
  export function c(size: number): any[]
}

/**
 * Native addon modules — resolved at runtime from vendor/.
 * Declared here to suppress TS2307 "cannot find module" errors.
 */
declare module 'audio-capture.node' {
  const mod: any
  export default mod
}

declare module 'color-diff-napi' {
  const mod: any
  export default mod
}

declare module 'modifiers-napi' {
  const mod: any
  export default mod
}

/**
 * Anthropic internal packages — stub declarations.
 * These packages are not available on public npm.
 * Provide real implementations or mocks to build successfully.
 */
declare module '@ant/claude-for-chrome-mcp' {
  const mod: any
  export default mod
  export const runClaudeInChromeMcpServer: () => Promise<void>
}

declare module '@ant/computer-use-input' {
  const mod: any
  export default mod
}

declare module '@ant/computer-use-mcp' {
  const mod: any
  export default mod
  export const runComputerUseMcpServer: () => Promise<void>
}

declare module '@ant/computer-use-swift' {
  const mod: any
  export default mod
}

declare module '@anthropic-ai/mcpb' {
  const mod: any
  export default mod
}

declare module '@anthropic-ai/sandbox-runtime' {
  const mod: any
  export default mod
}

/**
 * Non-JS asset imports — Bun inlines these as strings at bundle time.
 * TypeScript needs module declarations to recognize them.
 */
declare module '*.md' {
  const content: string
  export default content
}

declare module '*.txt' {
  const content: string
  export default content
}

/**
 * Additional missing package type declarations.
 */
declare module 'audio-capture-napi' {
  const mod: any
  export default mod
}

declare module 'plist' {
  export function parse(xml: string): any
  export function build(obj: any): string
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  export const SENTINEL_APPS: any
  export default SENTINEL_APPS
}
