// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

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
