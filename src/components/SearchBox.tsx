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
  /** Color the first N characters of the query (e.g. a recognized token) */
  highlightLen?: number
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
  highlightLen = 0,
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
            isTerminalFocused ? (
              renderQueryWithCursor(query, offset, highlightLen)
            ) : highlightLen > 0 ? (
              <>
                <Text color="suggestion">{query.slice(0, highlightLen)}</Text>
                <Text>{query.slice(highlightLen)}</Text>
              </>
            ) : (
              <Text>{query}</Text>
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

/** Query with an inverse-video cursor; the first `highlightLen` chars are colored. */
function renderQueryWithCursor(
  query: string,
  offset: number,
  highlightLen: number,
): React.ReactNode {
  const cursorChar = offset < query.length ? query[offset] : ' '
  // Cursor inside the highlighted span
  if (highlightLen > 0 && offset < highlightLen) {
    return (
      <>
        <Text color="suggestion">{query.slice(0, offset)}</Text>
        <Text color="suggestion" inverse>
          {cursorChar}
        </Text>
        <Text color="suggestion">{query.slice(offset + 1, highlightLen)}</Text>
        <Text>{query.slice(highlightLen)}</Text>
      </>
    )
  }
  return (
    <>
      {highlightLen > 0 && (
        <Text color="suggestion">{query.slice(0, highlightLen)}</Text>
      )}
      <Text>{query.slice(highlightLen, offset)}</Text>
      <Text inverse>{cursorChar}</Text>
      {offset < query.length && <Text>{query.slice(offset + 1)}</Text>}
    </>
  )
}
