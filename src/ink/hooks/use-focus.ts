import { useContext, useMemo, useSyncExternalStore } from 'react'
import AppContext from '../components/AppContext.js'
import type { DOMElement } from '../dom.js'

const noopSubscribe = () => () => {}

/**
 * Document focus for the current Ink root: the active element (re-renders on
 * change) plus focus navigation. Outside an Ink root everything is a no-op.
 */
export function useFocus() {
  const { focusManager, rootNode } = useContext(AppContext)
  const activeElement = useSyncExternalStore(
    focusManager?.subscribe ?? noopSubscribe,
    () => focusManager?.activeElement ?? null,
  )
  return useMemo(
    () => ({
      activeElement,
      focusNext: () => {
        if (focusManager && rootNode) focusManager.focusNext(rootNode)
      },
      focusPrevious: () => {
        if (focusManager && rootNode) focusManager.focusPrevious(rootNode)
      },
      focus: (node: DOMElement) => focusManager?.focus(node),
      blur: () => focusManager?.blur(),
      subscribe: focusManager?.subscribe ?? noopSubscribe,
    }),
    [activeElement, focusManager, rootNode],
  )
}
