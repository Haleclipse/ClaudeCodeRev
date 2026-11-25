import React, { useEffect, useState } from 'react'
import type { Companion } from '../../buddy/types.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { getRainbowColor } from '../../utils/thinking.js'
import { CompanionCard } from './CompanionCard.js'

const EGG = [
  '    _____    ',
  '   /     \\   ',
  '  /       \\  ',
  ' |         | ',
  '  \\       /  ',
  '   \\_____/   ',
]

// The first WOBBLE_FRAME_COUNT frames loop (the egg rocking) until the soul
// is generated; the rest play once (cracking open) before the reveal.
const FRAMES: Array<{ offset: number; lines: string[] }> = [
  { offset: 0, lines: EGG },
  { offset: 1, lines: EGG },
  { offset: -1, lines: EGG },
  { offset: 1, lines: EGG },
  {
    offset: 0,
    lines: [
      '    _____    ',
      '   /     \\   ',
      '  /       \\  ',
      ' |    .    | ',
      '  \\       /  ',
      '   \\_____/   ',
    ],
  },
  {
    offset: -1,
    lines: [
      '    _____    ',
      '   /     \\   ',
      '  /       \\  ',
      ' |    ∕    | ',
      '  \\       /  ',
      '   \\_____/   ',
    ],
  },
  {
    offset: 1,
    lines: [
      '    _____    ',
      '   /     \\   ',
      '  /   .   \\  ',
      ' |   ∕ \\   | ',
      '  \\       /  ',
      '   \\_____/   ',
    ],
  },
  {
    offset: 0,
    lines: [
      '    _____    ',
      '   /  .  \\   ',
      '  /  ∕ \\  \\  ',
      ' |  ∕   \\  | ',
      '  \\   .   /  ',
      '   \\_____/   ',
    ],
  },
  {
    offset: -1,
    lines: [
      '    _____    ',
      '   / ∕ \\ \\   ',
      '  / ∕   \\ \\  ',
      ' | ∕     \\ | ',
      '  \\   ∨   /  ',
      '   \\__∨__/   ',
    ],
  },
  {
    offset: 1,
    lines: [
      '    __ __    ',
      '   / V V \\   ',
      '  / ∕   \\ \\  ',
      ' | ∕     \\ | ',
      '  \\   ∨   /  ',
      '   \\__∨__/   ',
    ],
  },
  {
    offset: 0,
    lines: [
      '   ·  ✦  ·   ',
      '  ·       ·  ',
      ' ·    ✦    · ',
      '  ✦       ✦  ',
      ' ·    ·    · ',
      '   ·  ✦  ·   ',
    ],
  },
]

const FRAME_INTERVAL_MS = 160
const WOBBLE_FRAME_COUNT = 4
const CRACK_FRAME_COUNT = FRAMES.length - WOBBLE_FRAME_COUNT
// Wobble at least this many loops even if the soul comes back instantly
const MIN_WOBBLE_LOOPS = 3

type Props = {
  hatching: Promise<Companion>
  onDone: LocalJSXCommandOnDone
}

export function HatchingAnimation({ hatching, onDone }: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  const [tick, setTick] = useState(0)
  const [hatched, setHatched] = useState<Companion | null>(null)
  const [crackStartTick, setCrackStartTick] = useState<number | null>(
    null,
  )
  const [revealed, setRevealed] = useState<Companion | null>(null)

  useEffect(() => {
    const interval = setInterval(
      set => set(n => n + 1),
      FRAME_INTERVAL_MS,
      setTick,
    )
    hatching.then(setHatched)
    return () => clearInterval(interval)
  }, [hatching])

  const minWobbleTicks = MIN_WOBBLE_LOOPS * WOBBLE_FRAME_COUNT
  if (crackStartTick === null && hatched !== null && tick >= minWobbleTicks) {
    setCrackStartTick(tick)
  }

  let frameIndex: number
  if (crackStartTick === null) {
    frameIndex = tick % WOBBLE_FRAME_COUNT
  } else {
    const sinceCrack = tick - crackStartTick
    if (sinceCrack < CRACK_FRAME_COUNT) {
      frameIndex = WOBBLE_FRAME_COUNT + sinceCrack
    } else {
      frameIndex = FRAMES.length - 1
      if (!revealed && hatched) setRevealed(hatched)
    }
  }

  if (revealed) {
    return (
      <Box flexDirection="column">
        <CompanionCard companion={revealed} onDone={onDone} />
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            {revealed.name} is here · it'll chime in as you code
          </Text>
          <Text dimColor>your buddy won't count toward your usage</Text>
          <Text dimColor>
            say its name to get its take · /buddy pet · /buddy off
          </Text>
          <Box marginTop={1}>
            <Text dimColor>press any key</Text>
          </Box>
        </Box>
      </Box>
    )
  }

  const frame = FRAMES[frameIndex]!
  // Shift the egg left/right by one column to rock it
  const padLeft = ' '.repeat(1 + frame.offset)
  const padRight = ' '.repeat(1 - frame.offset)
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      width={columns}
      borderStyle="round"
      borderColor={getRainbowColor(tick)}
      paddingY={1}
    >
      {frame.lines.map((line, i) => (
        <Text key={i}>
          {padLeft}
          {line}
          {padRight}
        </Text>
      ))}
      <Box flexDirection="column" alignItems="center" marginTop={1}>
        <Text dimColor>hatching a coding buddy…</Text>
        <Text dimColor>it'll watch you work and occasionally have opinions</Text>
      </Box>
    </Box>
  )
}
