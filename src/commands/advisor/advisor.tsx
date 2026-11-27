import * as React from 'react'
import { Select } from '../../components/CustomSelect/select.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { Box, Text } from '../../ink.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { type AppState, useAppState, useSetAppState } from '../../state/AppState.js'
import type {
  LocalJSXCommandCall,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import {
  ADVISOR_TIERS,
  isValidAdvisorModel,
  modelSupportsAdvisor,
} from '../../utils/advisor.js'
import {
  normalizeModelStringForAPI,
  parseUserSpecifiedModel,
} from '../../utils/model/model.js'
import { validateModel } from '../../utils/model/validateModel.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'
import { renderModelLabel } from '../model/model.js'

type SetAppState = (updater: (prev: AppState) => AppState) => void

/**
 * Persist the advisor choice ('off' or a model) to app state and user
 * settings, and return the confirmation message.
 */
function applyAdvisorChoice(
  choice: string,
  mainLoopModel: string,
  setAppState: SetAppState,
): string {
  logEvent('tengu_advisor_command', {
    advisor:
      choice as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
  if (choice === 'off') {
    setAppState(s =>
      s.advisorModel === undefined ? s : { ...s, advisorModel: undefined },
    )
    updateSettingsForSource('userSettings', { advisorModel: undefined })
    return 'Advisor disabled'
  }
  const advisorModel = normalizeModelStringForAPI(choice)
  setAppState(s =>
    s.advisorModel === advisorModel ? s : { ...s, advisorModel },
  )
  updateSettingsForSource('userSettings', { advisorModel })
  const advisorLabel = renderModelLabel(advisorModel)
  const mainLabel = renderModelLabel(mainLoopModel)
  let message = `Advisor set to ${advisorLabel}`
  if (!modelSupportsAdvisor(mainLoopModel)) {
    message += `\nNote: the current main model (${mainLabel}) does not support the advisor. It will activate when you switch to a supported main model.`
  }
  return message
}

function AdvisorDialog({
  onDone,
}: {
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const advisorModel = useAppState(s => s.advisorModel)
  const mainLoopModel = useMainLoopModel()
  const setAppState = useSetAppState()

  const currentTier = advisorModel ? getAdvisorTier(advisorModel) : undefined
  // A configured advisor outside the listed tiers is kept as its own option
  const customOption =
    advisorModel && !currentTier
      ? { label: renderModelLabel(advisorModel), value: advisorModel }
      : undefined
  const options = [
    ...ADVISOR_TIERS.map(tier => ({
      label: renderModelLabel(tier),
      value: tier,
    })),
    ...(customOption ? [customOption] : []),
    { label: 'No advisor', value: 'off' },
  ]
  const initialValue = customOption ? customOption.value : (currentTier ?? 'off')

  React.useEffect(() => {
    logEvent('tengu_advisor_dialog_shown', {})
  }, [])

  return (
    <Dialog
      title="Advisor Tool"
      onCancel={() => onDone(undefined, { display: 'skip' })}
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          When Claude needs stronger judgment — a complex decision, an
          ambiguous failure, a problem it's circling without progress — it
          escalates to the advisor model for guidance, then resumes. The
          advisor runs server-side and uses additional tokens.
        </Text>
        <Text>
          For certain workloads, pairing Sonnet as the main model with Opus as
          the advisor gives you near-Opus performance with reduced token usage.
        </Text>
        {!modelSupportsAdvisor(mainLoopModel) && (
          <Text color="warning">
            The current main model ({renderModelLabel(mainLoopModel)}) does not
            support the advisor.
          </Text>
        )}
        <Select
          options={options}
          defaultValue={initialValue}
          defaultFocusValue={initialValue}
          onChange={value =>
            onDone(applyAdvisorChoice(value, mainLoopModel, setAppState))
          }
          onCancel={() => onDone(undefined, { display: 'skip' })}
        />
        {ADVISOR_LEARN_MORE_URL !== '' && (
          <Text>Learn more: {ADVISOR_LEARN_MORE_URL}</Text>
        )}
      </Box>
    </Dialog>
  )
}

function getAdvisorTier(model: string): string | undefined {
  const m = model.toLowerCase()
  return ADVISOR_TIERS.find(tier => m.includes(tier))
}

function ApplyAdvisorChoice({
  choice,
  onDone,
}: {
  choice: string
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const setAppState = useSetAppState()
  const mainLoopModel = useMainLoopModel()
  const appliedRef = React.useRef(false)
  React.useEffect(() => {
    if (appliedRef.current) return
    appliedRef.current = true
    onDone(applyAdvisorChoice(choice, mainLoopModel, setAppState))
  }, [choice, mainLoopModel, setAppState, onDone])
  return null
}

const ADVISOR_LEARN_MORE_URL = ''

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const arg = args.trim().toLowerCase()
  if (!arg) {
    return <AdvisorDialog onDone={onDone} />
  }
  if (arg === 'off' || arg === 'unset') {
    return <ApplyAdvisorChoice choice="off" onDone={onDone} />
  }
  const resolvedModel = parseUserSpecifiedModel(arg)
  const { valid, error } = await validateModel(resolvedModel)
  if (!valid || !isValidAdvisorModel(resolvedModel)) {
    onDone(
      error
        ? `Invalid advisor model: ${error}`
        : `${arg} cannot be used as an advisor. Valid options: ${ADVISOR_TIERS.join(', ')}, off`,
    )
    return null
  }
  return <ApplyAdvisorChoice choice={arg} onDone={onDone} />
}
