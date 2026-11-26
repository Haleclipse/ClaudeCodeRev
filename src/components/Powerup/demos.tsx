import sample from 'lodash-es/sample.js'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { computeShimmerSegments } from '../../bridge/bridgeStatusUtil.js'
import {
  BLACK_CIRCLE,
  DIAMOND_FILLED,
  DIAMOND_OPEN,
  EFFORT_MEDIUM,
  PAUSE_ICON,
} from '../../constants/figures.js'
import { useSettings } from '../../hooks/useSettings.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, type DOMElement, Text, useAnimationFrame } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js'
import type { Theme } from '../../utils/theme.js'

/**
 * Animated terminal demos for /powerup lessons. A demo is a list of frames;
 * each frame is a few lines of fake terminal output with inline color markup:
 * `[color:text]` colors a span with a theme color, a leading `#` dims the
 * whole line. Frames advance every FRAME_MS (static under reduced motion).
 */

type DemoSegment = { text: string; color?: keyof Theme }
type DemoLine = { dim: boolean; segments: DemoSegment[] }

const FRAME_MS = 3000
const DEMO_WIDTH = 48
const DEMO_HEIGHT = 3

type Particle = {
  x: number
  delay: number
  speed: number
  char: string
  color: keyof Theme
}

function DemoBox({
  live,
  boxRef,
  children,
}: {
  live?: boolean
  boxRef?: (element: DOMElement | null) => void
  children: React.ReactNode
}): React.ReactNode {
  return (
    <Box
      ref={boxRef}
      borderStyle="round"
      borderColor="inactive"
      paddingX={1}
      width={DEMO_WIDTH}
      height={DEMO_HEIGHT + 2}
    >
      <Box flexDirection="column" width={DEMO_WIDTH - 4} height={DEMO_HEIGHT}>
        {children}
      </Box>
      <Box position="absolute" marginLeft={DEMO_WIDTH - 12}>
        <Text dimColor={!live} color={live ? 'claude' : undefined}>
          {live ? `${DIAMOND_FILLED} try it` : `  ${EFFORT_MEDIUM} demo`}
        </Text>
      </Box>
    </Box>
  )
}

const MARKUP_RE = /\[(\w+):([^\]]*)\]/g

function parseDemoLine(line: string): DemoLine {
  const dim = line.startsWith('#')
  const body = dim ? line.slice(1) : line
  const segments: DemoSegment[] = []
  let last = 0
  for (const m of body.matchAll(MARKUP_RE)) {
    if (m.index > last) segments.push({ text: body.slice(last, m.index) })
    segments.push({ text: m[2]!, color: m[1] as keyof Theme })
    last = m.index + m[0].length
  }
  if (last < body.length) segments.push({ text: body.slice(last) })
  if (segments.length === 0) segments.push({ text: '' })
  return { dim, segments }
}

/** Cycles through `frames` inside a demo box. */
export function FrameDemo({ frames }: { frames: string[] }): React.ReactNode {
  const parsed = useMemo(() => frames.map(parseDemoFrame), [frames])
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  const [ref, time] = useAnimationFrame(reducedMotion ? null : FRAME_MS)
  const index = Math.floor(time / FRAME_MS) % parsed.length
  const frame = parsed[index]!
  return <DemoBox boxRef={ref}>{frame.map(renderDemoLine)}</DemoBox>
}

function renderDemoLine(line: DemoLine, i: number): React.ReactNode {
  return (
    <Text key={i} dimColor={line.dim}>
      {line.segments.map(renderDemoSegment)}
    </Text>
  )
}

function renderDemoSegment(segment: DemoSegment, i: number): React.ReactNode {
  return (
    <Text key={i} color={segment.color}>
      {segment.text}
    </Text>
  )
}

function parseDemoFrame(frame: string): DemoLine[] {
  return frame.split('\n').map(parseDemoLine)
}

// Permission modes in shift+tab order, as the prompt footer shows them.
const MODES: { label: string; symbol: string; color: keyof Theme }[] = [
  { label: 'default', symbol: '', color: 'text' },
  { label: 'accept edits on', symbol: '⏵⏵', color: 'autoAccept' },
  { label: 'plan mode on', symbol: PAUSE_ICON, color: 'planMode' },
  { label: 'auto mode on', symbol: '⏵⏵', color: 'warning' },
]

const SHIMMER_FRAME_MS = 80
const CONFETTI_FRAME_MS = 60
const CONFETTI_DURATION_MS = 1400
const CONFETTI_ROWS = 16
const CONFETTI_MARGIN = 60
const CONFETTI_WIDTH = 100
const CONFETTI_CHARS = [DIAMOND_FILLED, DIAMOND_OPEN, BLACK_CIRCLE, '·']
const CONFETTI_COLORS: (keyof Theme)[] = [
  'claude',
  'success',
  'warning',
  'suggestion',
  'autoAccept',
]

function makeParticles(count: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.floor(Math.random() * CONFETTI_WIDTH),
      delay: Math.random() * 400,
      speed: 0.7 + Math.random() * 0.6,
      char: sample(CONFETTI_CHARS)!,
      color: sample(CONFETTI_COLORS)!,
    })
  }
  return particles
}

/** One-shot confetti burst, shown when the last lesson is marked done. */
export function Confetti({ onDone }: { onDone: () => void }): React.ReactNode {
  const particles = useMemo(() => makeParticles(40), [])
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  const [ref, time] = useAnimationFrame(
    reducedMotion ? null : CONFETTI_FRAME_MS,
  )
  const startTime = useRef(time)
  const elapsed = time - startTime.current

  useEffect(() => {
    const timer = setTimeout(onDone, CONFETTI_DURATION_MS + 600)
    return () => clearTimeout(timer)
  }, [onDone])

  const rows: Particle[][] = Array.from({ length: CONFETTI_ROWS }, () => [])
  for (const p of particles) {
    const t = Math.max(0, elapsed - p.delay)
    const row = Math.floor((t / CONFETTI_DURATION_MS) * CONFETTI_ROWS * p.speed)
    if (row >= 0 && row < CONFETTI_ROWS) rows[row]!.push(p)
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x)

  return (
    <Box
      ref={ref}
      position="absolute"
      marginLeft={CONFETTI_MARGIN}
      flexDirection="column"
      width={CONFETTI_WIDTH}
      height={CONFETTI_ROWS}
    >
      {rows.map((row, i) => {
        let col = 0
        return (
          <Box key={i} height={1}>
            {row.map((p, j) => {
              const pad = Math.max(0, p.x - col)
              col = Math.max(col, p.x) + 1
              return (
                <Text key={j}>
                  {' '.repeat(pad)}
                  <Text color={p.color}>{p.char}</Text>
                </Text>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}

/** Bold claude-colored text with a moving shimmer highlight. */
export function ShimmerText({ text }: { text: string }): React.ReactNode {
  const width = stringWidth(text)
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  const [ref, time] = useAnimationFrame(reducedMotion ? null : SHIMMER_FRAME_MS)
  const cycle = width + 20
  const glimmerIndex = (Math.floor(time / SHIMMER_FRAME_MS) % cycle) - 10
  const { before, shimmer, after } = computeShimmerSegments(text, glimmerIndex)
  return (
    <Box ref={ref}>
      <Text bold color="claude">
        {before}
      </Text>
      <Text bold color="claudeShimmer">
        {shimmer}
      </Text>
      <Text bold color="claude">
        {after}
      </Text>
    </Box>
  )
}

/** Live demo: pressing the real cycle-mode shortcut steps through the modes. */
export function ModeCycleDemo(): React.ReactNode {
  const [index, setIndex] = useState(0)
  const mode = MODES[index]!
  const shortcut = useShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab')
  useKeybindings(
    { 'confirm:cycleMode': () => setIndex(nextModeIndex) },
    { context: 'Confirmation' },
  )
  return (
    <DemoBox live>
      <Text>
        <Text dimColor>
          Press {shortcut} now{'\n\n'}
        </Text>
        <Text color={mode.color}>
          {mode.symbol ? `${mode.symbol} ` : '  '}
          {mode.label}
        </Text>
      </Text>
    </DemoBox>
  )
}

function nextModeIndex(i: number): number {
  return (i + 1) % MODES.length
}
