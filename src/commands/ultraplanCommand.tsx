import type { Command } from '../commands.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import type { LocalJSXCommandCall } from '../types/command.js'
import {
  buildAlreadyActiveMessage,
  CCR_TERMS_URL,
  launchUltraplan,
} from './ultraplan.js'

// The /ultraplan slash command. Kept apart from ultraplan.tsx (the launch and
// polling logic, which the keyword trigger and the plan-approval dialog use
// too) so the command object is only bundled when the ULTRAPLAN feature
// requires it from commands.ts.

const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const blurb = args.trim()

  // Bare /ultraplan (no args, no seed plan) just shows usage — no dialog.
  if (!blurb) {
    const msg = await launchUltraplan({
      blurb,
      getAppState: context.getAppState,
      setAppState: context.setAppState,
      signal: context.abortController.signal,
    })
    onDone(msg, { display: 'system' })
    return null
  }

  // Guard matches launchUltraplan's own check — showing the dialog when a
  // session is already active or launching would waste the user's click and set
  // hasSeenUltraplanTerms before the launch fails.
  const { ultraplanSessionUrl: active, ultraplanLaunching } =
    context.getAppState()
  if (active || ultraplanLaunching) {
    logEvent('tengu_ultraplan_create_failed', {
      reason: (active
        ? 'already_polling'
        : 'already_launching') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    onDone(buildAlreadyActiveMessage(active), { display: 'system' })
    return null
  }

  // Mount the pre-launch dialog via focusedInputDialog (bottom region, like
  // permission dialogs) rather than returning JSX (transcript area, anchors
  // at top of scrollback). REPL.tsx handles launch/clear/cancel on choice.
  context.setAppState(prev => ({ ...prev, ultraplanLaunchPending: { blurb } }))
  // 'skip' suppresses the (no content) echo — the dialog's choice handler
  // adds the real /ultraplan echo + launch confirmation.
  onDone(undefined, { display: 'skip' })
  return null
}

export default {
  type: 'local-jsx',
  name: 'ultraplan',
  description: `~10–30 min · Claude Code on the web drafts an advanced plan you can edit and approve. See ${CCR_TERMS_URL}`,
  argumentHint: '<prompt>',
  isEnabled: () => "external" === 'ant',
  load: () => Promise.resolve({ call }),
} satisfies Command
