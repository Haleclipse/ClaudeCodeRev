import React from 'react'
import { BLACK_CIRCLE } from '../../constants/figures.js'
import { Box, Text } from '../../ink.js'
import { useDebouncedDigitInput } from './useDebouncedDigitInput.js'

export type TranscriptShareResponse = 'yes' | 'no' | 'dont_ask_again'

type Props = {
  onSelect: (option: TranscriptShareResponse) => void
  inputValue: string
  setInputValue: (value: string) => void
}

// Letters rather than digits, so digits typed in quick succession don't
// select an option
const RESPONSE_INPUTS = ['y', 'n', 'd'] as const
type ResponseInput = (typeof RESPONSE_INPUTS)[number]

const inputToResponse: Record<ResponseInput, TranscriptShareResponse> = {
  y: 'yes',
  n: 'no',
  d: 'dont_ask_again',
} as const

export const isValidResponseInput = (input: string): input is ResponseInput =>
  (RESPONSE_INPUTS as readonly string[]).includes(input)

export function TranscriptSharePrompt({
  onSelect,
  inputValue,
  setInputValue,
}: Props): React.ReactNode {
  useDebouncedDigitInput({
    inputValue,
    setInputValue,
    isValidDigit: (char: string): char is ResponseInput =>
      isValidResponseInput(char.toLowerCase()),
    onDigit: digit => {
      const key = digit.toLowerCase()
      if (isValidResponseInput(key)) onSelect(inputToResponse[key])
    },
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="ansi:cyan">{BLACK_CIRCLE} </Text>
        <Text bold>
          Can Anthropic look at your session transcript to help us improve
          Claude Code?
        </Text>
      </Box>

      <Box marginLeft={2}>
        <Text dimColor>
          Learn more:
          https://code.claude.com/docs/en/data-usage#session-quality-surveys
        </Text>
      </Box>

      <Box marginLeft={2}>
        <Box width={10}>
          <Text>
            <Text color="ansi:cyan">y</Text>: Yes
          </Text>
        </Box>
        <Box width={10}>
          <Text>
            <Text color="ansi:cyan">n</Text>: No
          </Text>
        </Box>
        <Box>
          <Text>
            <Text color="ansi:cyan">d</Text>: Don't ask again
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
