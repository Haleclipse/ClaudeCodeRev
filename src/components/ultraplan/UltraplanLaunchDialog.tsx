import * as React from 'react'
import { useState } from 'react'
import {
  CCR_TERMS_URL,
  getUltraplanPromptCopy,
  getUltraplanPromptIdentifier,
  type UltraplanPromptIdentifier,
} from '../../commands/ultraplan.js'
import { useRegisterOverlay } from '../../context/overlayContext.js'
import { Box, Link, Text } from '../../ink.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { Select } from '../CustomSelect/select.js'
import { Dialog } from '../design-system/Dialog.js'

export type UltraplanLaunchChoice = 'run' | 'cancel'

type Props = {
  onChoice: (
    choice: UltraplanLaunchChoice,
    opts?: {
      /** True if Remote Control was turned off to launch. */
      disconnectedBridge?: boolean
      /** Prompt variant the dialog copy was built from. */
      promptIdentifier?: UltraplanPromptIdentifier
    },
  ) => void
}

/**
 * Pre-launch confirmation for /ultraplan (slash command or keyword). Mounted
 * by REPL while ultraplanLaunchPending is set.
 */
export function UltraplanLaunchDialog({ onChoice }: Props): React.ReactNode {
  useRegisterOverlay('ultraplan-launch')
  const [showTerms] = useState(() => !getGlobalConfig().hasSeenUltraplanTerms)
  // Read once and handed to launchUltraplan via onChoice, so the session
  // runs the variant this copy describes.
  const [promptIdentifier] = useState(() => getUltraplanPromptIdentifier())
  const copy = getUltraplanPromptCopy(promptIdentifier)
  const replBridgeEnabled = useAppState(s => s.replBridgeEnabled)
  const setAppState = useSetAppState()

  function handleChoice(choice: UltraplanLaunchChoice): void {
    const disconnectedBridge = choice === 'run' && replBridgeEnabled
    if (disconnectedBridge) {
      setAppState(prev => {
        if (!prev.replBridgeEnabled) return prev
        return {
          ...prev,
          replBridgeEnabled: false,
          replBridgeExplicit: false,
          replBridgeOutboundOnly: false,
        }
      })
    }
    if (choice !== 'cancel' && showTerms) {
      saveGlobalConfig(current =>
        current.hasSeenUltraplanTerms
          ? current
          : { ...current, hasSeenUltraplanTerms: true },
      )
    }
    onChoice(choice, { disconnectedBridge, promptIdentifier })
  }

  return (
    <Dialog
      title="Run ultraplan in the cloud?"
      subtitle={copy.timeEstimate}
      onCancel={() => handleChoice('cancel')}
    >
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text dimColor>{copy.dialogBody}</Text>
          {replBridgeEnabled && (
            <Text dimColor>
              This will disable Remote Control for this session.
            </Text>
          )}
          {showTerms && (
            <Text dimColor>
              For more information on Claude Code on the web:{' '}
              <Link url={CCR_TERMS_URL}>{CCR_TERMS_URL}</Link>
            </Text>
          )}
        </Box>
        {!replBridgeEnabled && <Text dimColor>{copy.dialogPipeline}</Text>}
        <Select
          options={[
            {
              label: 'Run ultraplan',
              value: 'run' as const,
              description: replBridgeEnabled
                ? 'Disable remote control and launch in Claude Code on the web'
                : 'launch in Claude Code on the web',
            },
            { label: 'Not now', value: 'cancel' as const },
          ]}
          onChange={handleChoice}
        />
      </Box>
    </Dialog>
  )
}
