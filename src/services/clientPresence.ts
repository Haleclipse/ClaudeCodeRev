import axios from 'axios'
// Import order mirrors the module-init order of the 2.1.92 bundle.
import { randomUUID } from '../utils/crypto.js'
import { onInteraction } from '../bootstrap/state.js'
import { logForDebugging } from '../utils/debug.js'
import { isEssentialTrafficOnly } from '../utils/privacyLevel.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from './analytics/growthbook.js'

/**
 * Remote Control client presence: while a bridge session is up, each user
 * interaction (throttled to one per PRESENCE_PULSE_MS) tells the server this
 * terminal is actively in use, so claude.ai can show the session as attended.
 * Fire-and-forget — failures are logged and ignored.
 */

type PresenceTarget = {
  sessionId: string
  baseUrl: string
  getAuthHeaders: () => Record<string, string>
}

// Start (or restart) presence pulses for a bridge session.
export function startClientPresence(
  sessionId: string,
  baseUrl: string,
  getAuthHeaders: () => Record<string, string>,
): void {
  stopClientPresence()
  if (isEssentialTrafficOnly()) return
  if (
    !getFeatureValue_CACHED_MAY_BE_STALE(
      'tengu_bridge_client_presence_enabled',
      false,
    )
  ) {
    return
  }
  target = { sessionId, baseUrl, getAuthHeaders }
  lastPulseAt = 0
  unsubscribe = onInteraction(sendPresencePulse)
  logForDebugging(`[presence] wired for session ${sessionId}`)
}

export function stopClientPresence(): void {
  unsubscribe?.()
  unsubscribe = null
  target = null
  connectedAt = null
}

function sendPresencePulse(): void {
  if (!target) return
  const now = Date.now()
  if (now - lastPulseAt < PRESENCE_PULSE_MS) return
  lastPulseAt = now
  connectedAt ??= new Date(now).toISOString()
  const url = `${target.baseUrl}/v1/code/sessions/${target.sessionId}/client/presence`
  logForDebugging(`[presence] pulse → ${url}`)
  void axios
    .post(
      url,
      { client_id: CLIENT_ID, connected_at: connectedAt },
      {
        headers: {
          ...target.getAuthHeaders(),
          'anthropic-version': '2023-06-01',
          'anthropic-client-platform': 'cli',
        },
        timeout: PRESENCE_PULSE_MS,
        validateStatus: () => true,
      },
    )
    .then(
      response => {
        if (response.status >= 400) {
          logForDebugging(`[presence] pulse got ${response.status}`)
        }
      },
      () => {},
    )
}

// Pulse throttle, and the request timeout
const PRESENCE_PULSE_MS = 5000
// Stable for the process: identifies this terminal across sessions
const CLIENT_ID = randomUUID()
let target: PresenceTarget | null = null
let unsubscribe: (() => void) | null = null
let connectedAt: string | null = null
let lastPulseAt = 0
