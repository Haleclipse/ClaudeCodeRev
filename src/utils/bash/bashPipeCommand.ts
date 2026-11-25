/**
 * Quotes a command and adds `< /dev/null` as a shell redirect on eval, rather than
 * as an eval argument. This is critical for pipe commands: the redirect then
 * applies to eval as a whole, so the FIRST pipe stage reads /dev/null and the
 * later stages keep reading from the pipe.
 *
 * Using `singleQuoteForEval(cmd) + ' < /dev/null'` produces: eval 'cmd' < /dev/null
 *   → eval's stdin is /dev/null, eval evaluates 'cmd', pipes inside work correctly
 *
 * The previous approach `quote([cmd, '<', '/dev/null'])` produced: eval 'cmd' \< /dev/null
 *   → eval concatenates args to 'cmd < /dev/null', redirect applies to LAST pipe command
 */
export function quoteWithEvalStdinRedirect(command: string): string {
  return singleQuoteForEval(command) + ' < /dev/null'
}

/**
 * Single-quote a string for use as an eval argument. Escapes embedded single
 * quotes via '"'"' (close-sq, literal-sq-in-dq, reopen-sq). Used instead of
 * shell-quote's quote() which switches to double-quote mode when the input
 * contains single quotes and then escapes ! -> \!, corrupting jq/awk filters
 * like `select(.x != .y)` into `select(.x \!= .y)`.
 */
function singleQuoteForEval(s: string): string {
  return "'" + s.replaceAll("'", `'"'"'`) + "'"
}
