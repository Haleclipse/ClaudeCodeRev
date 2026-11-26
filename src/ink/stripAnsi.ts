import stripAnsiNpm from 'strip-ansi'

// Bun ships a native ANSI stripper; the strip-ansi package is the fallback
// (Node). Dependencies such as wrap-ansi keep using strip-ansi directly.
const stripAnsiBun =
  typeof Bun !== 'undefined' && typeof Bun.stripANSI === 'function'
    ? Bun.stripANSI
    : null

const stripAnsi: (text: string) => string = stripAnsiBun ?? stripAnsiNpm

export { stripAnsi }
