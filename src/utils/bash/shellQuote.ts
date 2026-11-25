/**
 * POSIX shell quoting for building command strings.
 */

/**
 * Quote each argument for a POSIX shell and join them with spaces.
 *
 * Safe words (characters that never need quoting) pass through unchanged;
 * everything else is single-quoted, with embedded single quotes written as
 * '"'"' (close, literal quote in double quotes, reopen). Single quotes disable
 * every expansion ($, `, !, globs), so the result is always taken literally.
 */
export function quote(args: ReadonlyArray<unknown>): string {
  return args
    .map(arg => {
      const s = String(arg)
      if (s === '') return "''"
      if (/^[A-Za-z0-9_./:=@+,-]+$/.test(s)) return s
      return "'" + s.replaceAll("'", `'"'"'`) + "'"
    })
    .join(' ')
}
