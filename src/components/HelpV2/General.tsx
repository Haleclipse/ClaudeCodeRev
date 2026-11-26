import * as React from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { PromptInputHelpMenu } from '../PromptInput/PromptInputHelpMenu.js'

// The /powerup hint only shows when the terminal is tall enough that it doesn't
// push the shortcut list off screen.
const POWERUP_HINT_MIN_ROWS = 44

export function General(): React.ReactNode {
  const { rows } = useTerminalSize()
  return (
    <Box flexDirection="column" paddingY={1} gap={1}>
      <Box>
        <Text>
          Claude understands your codebase, makes edits with your permission,
          and executes commands — right from your terminal.
        </Text>
      </Box>
      {rows >= POWERUP_HINT_MIN_ROWS && (
        <Box>
          <Text dimColor>
            New here? Run <Text color="suggestion">/powerup</Text> to learn the
            features most people miss.
          </Text>
        </Box>
      )}
      <Box flexDirection="column">
        <Box>
          <Text bold>Shortcuts</Text>
        </Box>
        <PromptInputHelpMenu gap={2} fixedWidth={true} />
      </Box>
    </Box>
  )
}
