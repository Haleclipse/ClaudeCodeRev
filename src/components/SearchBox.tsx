import React from 'react'
import { Box, Text } from '../ink.js'

type Props = {
  query: string
  placeholder?: string
  isFocused: boolean
  isTerminalFocused: boolean
  prefix?: string
  width?: number | string
  cursorOffset?: number
  borderless?: boolean
  /** [start, end) ranges of the query to color (e.g. recognized tokens) */
  highlights?: ReadonlyArray<readonly [number, number]>
  /** Render the prefix dimmed even while focused */
  prefixDim?: boolean
}

export function SearchBox({
  query,
  placeholder = 'Search…',
  isFocused,
  isTerminalFocused,
  prefix = '⌕',
  width,
  cursorOffset,
  borderless = false,
  highlights = [],
  prefixDim = false,
}: Props): React.ReactNode {
  const offset = cursorOffset ?? query.length

  return (
    <Box
      flexShrink={0}
      borderStyle={borderless ? undefined : 'round'}
      borderColor={isFocused ? 'suggestion' : undefined}
      borderDimColor={!isFocused}
      paddingX={borderless ? 0 : 1}
      width={width}
    >
      <Text dimColor={!isFocused}>
        <Text dimColor={prefixDim}>{prefix}</Text>{' '}
        {isFocused ? (
          query ? (
            renderHighlightedQuery(
              query,
              highlights,
              isTerminalFocused ? offset : -1,
            )
          ) : isTerminalFocused ? (
            <>
              <Text inverse>{placeholder.charAt(0)}</Text>
              <Text dimColor>{placeholder.slice(1)}</Text>
            </>
          ) : (
            <Text dimColor>{placeholder}</Text>
          )
        ) : query ? (
          <Text>{query}</Text>
        ) : (
          <Text>{placeholder}</Text>
        )}
      </Text>
    </Box>
  )
}

/**
 * Render the query split at highlight-range and cursor boundaries: chars
 * inside any [start, end) range are colored; the char at `cursor` is
 * inverse-video (pass -1 for no cursor). A cursor at the end renders as a
 * trailing inverse space.
 */
function renderHighlightedQuery(
  query: string,
  highlights: ReadonlyArray<readonly [number, number]>,
  cursor: number,
): React.ReactNode {
  const isHighlighted = (i: number) =>
    highlights.some(([start, end]) => i >= start && i < end)
  const boundaries = new Set([0, query.length])
  for (const [start, end] of highlights) {
    boundaries.add(start)
    boundaries.add(end)
  }
  if (cursor >= 0) {
    boundaries.add(cursor)
    boundaries.add(cursor + 1)
  }
  const points = [...boundaries].sort((a, b) => a - b)
  const segments: React.ReactNode[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!
    const end = points[i + 1]!
    const text = start < query.length ? query.slice(start, end) : ' '
    if (!text) continue
    segments.push(
      <Text
        key={start}
        color={isHighlighted(start) ? 'suggestion' : undefined}
        inverse={start === cursor}
      >
        {text}
      </Text>,
    )
  }
  return segments
}
