import React from 'react'
import { Box, Text } from '../ink.js'
import { formatTokens } from '../utils/format.js'
import { Select } from './CustomSelect/index.js'
import { Dialog } from './design-system/Dialog.js'

export type ResumeReturnAction = 'compact' | 'continue' | 'dismiss' | 'never'

type Props = {
  sessionAgeMinutes: number
  estimatedTokens: number
  onDone: (action: ResumeReturnAction) => void
}

/**
 * Shown when resuming a session that is both old and large: re-sending the
 * whole history (now a cold prompt cache) is expensive, so offer to resume
 * from a /compact summary instead.
 */
export function ResumeReturnDialog({
  sessionAgeMinutes,
  estimatedTokens,
  onDone,
}: Props): React.ReactNode {
  const formattedAge = formatSessionAge(sessionAgeMinutes)
  const formattedTokens = formatTokens(estimatedTokens)

  return (
    <Dialog
      title={`This session is ${formattedAge} old and ${formattedTokens} tokens.`}
      onCancel={() => onDone('dismiss')}
    >
      <Box flexDirection="column">
        <Text>
          Resuming the full session will consume a substantial portion of your
          usage limits. We recommend resuming from a summary.
        </Text>
      </Box>
      <Select
        options={[
          {
            value: 'compact' as const,
            label: 'Resume from summary (recommended)',
          },
          {
            value: 'continue' as const,
            label: 'Resume full session as-is',
          },
          {
            value: 'never' as const,
            label: "Don't ask me again",
          },
        ]}
        onChange={(value: ResumeReturnAction) => onDone(value)}
      />
    </Dialog>
  )
}

/** 45m · 3h 20m · 2d 5h */
function formatSessionAge(minutes: number): string {
  if (minutes < 60) {
    return `${Math.floor(minutes)}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const remainingMinutes = Math.floor(minutes % 60)
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`
}
