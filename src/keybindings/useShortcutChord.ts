import { useEffect, useRef } from 'react'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import { useOptionalKeybindingContext } from './KeybindingContext.js'
import { chordToString } from './parser.js'
import type { KeybindingContextName } from './types.js'

/**
 * Hook to get the chord configured for an action, as a chord string for
 * KeyboardShortcutHint's `chord` prop (formatting happens at render time).
 * The last binding for the action in the context wins, matching how user
 * bindings override defaults. Falls back when no binding is found.
 *
 * @param action - The action name (e.g., 'app:toggleTranscript')
 * @param context - The keybinding context (e.g., 'Global')
 * @param fallback - Chord to use if keybinding context or binding is unavailable
 */
export function useShortcutChord(
  action: string,
  context: KeybindingContextName,
  fallback: string,
): string {
  const keybindingContext = useOptionalKeybindingContext()
  const chord = keybindingContext?.bindings.findLast(
    binding => binding.action === action && binding.context === context,
  )?.chord
  const isFallback = chord === undefined
  const reason = keybindingContext ? 'action_not_found' : 'no_context'

  // Log fallback usage once per mount (not on every render)
  const hasLoggedRef = useRef(false)
  useEffect(() => {
    if (isFallback && !hasLoggedRef.current) {
      hasLoggedRef.current = true
      logEvent('tengu_keybinding_fallback_used', {
        action:
          action as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        context:
          context as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        fallback:
          fallback as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        reason:
          reason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
    }
  }, [isFallback, action, context, fallback, reason])

  return chord ? chordToString(chord) : fallback
}
