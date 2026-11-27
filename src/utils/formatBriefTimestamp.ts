import { getDateTimeFormat } from './intl.js'
import { textBefore } from './stringUtils.js'

const SAME_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
}
const WITHIN_WEEK_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
}
const OLDER_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}
// Resolved locale per raw env value
const resolvedLocaleCache = new Map<string, string | undefined>()

/**
 * Format an ISO timestamp for the brief/chat message label line.
 *
 * Display scales with age (like a messaging app):
 *   - same day:      "1:30 PM" or "13:30" (locale-dependent)
 *   - within 6 days: "Sunday, 4:15 PM" (locale-dependent)
 *   - older:         "Sunday, Feb 20, 4:30 PM" (locale-dependent)
 *
 * Respects POSIX locale env vars (LC_ALL > LC_TIME > LANG) for time format
 * (12h/24h), weekday names, month names, and overall structure.
 * Bun/V8's `toLocaleString(undefined)` ignores these on macOS, so we
 * convert them to BCP 47 tags ourselves.
 *
 * `now` is injectable for tests.
 */
export function formatBriefTimestamp(
  isoString: string,
  now: Date = new Date(),
): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) {
    return ''
  }

  const locale = getResolvedLocale()
  const dayDiff = startOfDay(now) - startOfDay(d)
  const daysAgo = Math.round(dayDiff / 86_400_000)

  if (daysAgo === 0) {
    return getDateTimeFormat(locale, SAME_DAY_FORMAT).format(d)
  }

  if (daysAgo > 0 && daysAgo < 7) {
    return getDateTimeFormat(locale, WITHIN_WEEK_FORMAT).format(d)
  }

  return getDateTimeFormat(locale, OLDER_FORMAT).format(d)
}

function getResolvedLocale(): string | undefined {
  const raw =
    process.env.LC_ALL || process.env.LC_TIME || process.env.LANG || ''
  if (resolvedLocaleCache.has(raw)) {
    return resolvedLocaleCache.get(raw)
  }
  const locale = getLocale(raw)
  resolvedLocaleCache.set(raw, locale)
  return locale
}

/**
 * Derive a BCP 47 locale tag from a POSIX locale value (LC_ALL > LC_TIME >
 * LANG, resolved by the caller); undefined means the system default.
 * Converts POSIX format (en_GB.UTF-8) to BCP 47 (en-GB).
 */
function getLocale(raw: string): string | undefined {
  if (!raw || raw === 'C' || raw === 'POSIX') {
    return undefined
  }
  // Strip codeset (.UTF-8) and modifier (@euro), replace _ with -
  const base = textBefore(textBefore(raw, '.'), '@')
  if (!base) {
    return undefined
  }
  const tag = base.replaceAll('_', '-')
  // Validate by trying to construct an Intl locale — invalid tags throw
  try {
    new Intl.DateTimeFormat(tag)
    return tag
  } catch {
    return undefined
  }
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
