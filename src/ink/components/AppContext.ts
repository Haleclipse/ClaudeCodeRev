import { createContext } from 'react'
import type { DOMElement } from '../dom.js'
import type { FocusManager } from '../focus.js'

export type Props = {
  /**
   * Exit (unmount) the whole Ink app.
   */
  readonly exit: (error?: Error) => void
  /** Document focus manager (null outside an Ink root, e.g. in tests). */
  readonly focusManager?: FocusManager | null
  /** ink-root node, the scope for focusNext/focusPrevious. */
  readonly rootNode?: DOMElement | null
}

/**
 * `AppContext` is a React context, which exposes a method to manually exit the app (unmount).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const AppContext = createContext<Props>({
  exit() {},
  focusManager: null,
  rootNode: null,
})

// eslint-disable-next-line custom-rules/no-top-level-side-effects
AppContext.displayName = 'InternalAppContext'

export default AppContext
