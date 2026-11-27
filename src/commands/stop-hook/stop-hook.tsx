import * as React from 'react'
import { getSessionId } from '../../bootstrap/state.js'
import { StopHookDialog } from '../../components/hooks/StopHookDialog.js'
import { logEvent } from '../../services/analytics/index.js'
import type { AppState } from '../../state/AppState.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  addSessionHook,
  getSessionHooks,
  removeSessionHook,
} from '../../utils/hooks/sessionHooks.js'
import type { PromptHook } from '../../utils/settings/types.js'

/** Prompt-type Stop hooks with an empty matcher in the current session. */
function getSessionStopPromptHooks(
  appState: AppState,
  sessionId: string,
): PromptHook[] {
  const matchers = getSessionHooks(appState, sessionId, 'Stop')
  const hooks: PromptHook[] = []
  for (const matcher of matchers.get('Stop') ?? []) {
    if (matcher.matcher !== '') continue
    for (const hook of matcher.hooks) {
      if (hook.type === 'prompt') hooks.push(hook)
    }
  }
  return hooks
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  logEvent('tengu_stop_hook_command', {})
  const setAppState = context.setAppStateForTasks ?? context.setAppState
  const sessionId = getSessionId()
  const existingHooks = getSessionStopPromptHooks(
    context.getAppState(),
    sessionId,
  )
  const existingPrompt = existingHooks[0]?.prompt
  const initialPrompt = args.trim() || existingPrompt || ''

  function handleSubmit(prompt: string): void {
    // Empty prompt clears the hook
    if (prompt.length === 0) {
      for (const hook of existingHooks) {
        removeSessionHook(setAppState, sessionId, 'Stop', hook)
      }
      const message =
        existingHooks.length > 0 ? 'Stop hook cleared' : 'Cancelled'
      if (existingHooks.length > 0) {
        logEvent('tengu_stop_hook_removed', {})
      }
      onDone(message, { display: 'system' })
      return
    }
    if (existingPrompt === prompt) {
      onDone('Stop hook unchanged', { display: 'system' })
      return
    }
    for (const hook of existingHooks) {
      removeSessionHook(setAppState, sessionId, 'Stop', hook)
    }
    addSessionHook(setAppState, sessionId, 'Stop', '', {
      type: 'prompt',
      prompt,
    })
    logEvent('tengu_stop_hook_added', { promptLength: prompt.length })
    onDone(existingHooks.length === 0 ? 'Stop hook set' : 'Stop hook updated', {
      display: 'system',
    })
  }

  function handleCancel(): void {
    onDone('Cancelled', { display: 'system' })
  }

  return (
    <StopHookDialog
      initialPrompt={initialPrompt}
      existingHookPresent={existingPrompt !== undefined}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  )
}
