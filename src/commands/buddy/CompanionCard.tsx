import React from 'react'
import { renderSprite } from '../../buddy/sprites.js'
import {
  type Companion,
  RARITY_COLORS,
  RARITY_STARS,
  STAT_NAMES,
} from '../../buddy/types.js'
import { Box, Text, useInput } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

function StatBar({
  name,
  value,
}: {
  name: string
  value: number
}): React.ReactNode {
  const filled = Math.round(value / 10)
  return (
    <Box>
      <Text>{name.padEnd(10)} </Text>
      <Text>
        {'█'.repeat(filled)}
        {'░'.repeat(10 - filled)}{' '}
      </Text>
      <Text dimColor>{String(value).padStart(3)}</Text>
    </Box>
  )
}

type Props = {
  companion: Companion
  lastReaction?: string
  onDone?: LocalJSXCommandOnDone
}

// The companion's "trading card": rarity, sprite, name, personality, stats,
// and the last thing it said. Any key dismisses it.
export function CompanionCard({
  companion,
  lastReaction,
  onDone,
}: Props): React.ReactNode {
  const color = RARITY_COLORS[companion.rarity]
  const sprite = renderSprite(companion)

  useInput(() => onDone?.(undefined, { display: 'skip' }), {
    isActive: onDone !== undefined,
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={2}
      paddingY={1}
      width={40}
      flexShrink={0}
    >
      <Box justifyContent="space-between">
        <Text bold color={color}>
          {RARITY_STARS[companion.rarity]} {companion.rarity.toUpperCase()}
        </Text>
        <Text color={color}>{companion.species.toUpperCase()}</Text>
      </Box>
      {companion.shiny && (
        <Text color="warning" bold>
          ✨ SHINY ✨
        </Text>
      )}
      <Box flexDirection="column" marginY={1}>
        {sprite.map((line, i) => (
          <Text key={i} color={color}>
            {line}
          </Text>
        ))}
      </Box>
      <Text bold>{companion.name}</Text>
      <Box marginY={1}>
        <Text dimColor italic>
          {`"${companion.personality}"`}
        </Text>
      </Box>
      <Box flexDirection="column">
        {STAT_NAMES.map(name => (
          <StatBar key={name} name={name} value={companion.stats[name]} />
        ))}
      </Box>
      {lastReaction && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>last said</Text>
          <Box borderStyle="round" borderColor="inactive" paddingX={1}>
            <Text dimColor italic>
              {lastReaction}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
