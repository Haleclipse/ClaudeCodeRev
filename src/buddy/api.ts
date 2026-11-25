import axios from 'axios'
import { getOauthConfig, OAUTH_BETA_HEADER } from '../constants/oauth.js'
import {
  checkAndRefreshOAuthTokenIfNeeded,
  getClaudeAIOAuthTokens,
} from '../utils/auth.js'
import { getGlobalConfig } from '../utils/config.js'
import { logForDebugging } from '../utils/debug.js'
import { getAPIProvider } from '../utils/model/providers.js'
import { isEssentialTrafficOnly } from '../utils/privacyLevel.js'
import { getClaudeCodeUserAgent } from '../utils/userAgent.js'
import type { Companion } from './types.js'

export type BuddyReactionReason =
  | 'turn'
  | 'test-fail'
  | 'error'
  | 'large-diff'
  | 'hatch'
  | 'pet'

/**
 * Asks the server for a one-line reaction from the companion. First-party
 * OAuth only (the endpoint is org-scoped); returns null on any failure — a
 * missing quip is never worth surfacing.
 */
export async function requestBuddyReaction(
  companion: Companion,
  transcript: string,
  reason: BuddyReactionReason,
  recent: string[],
  addressed: boolean,
  signal: AbortSignal,
): Promise<string | null> {
  if (getAPIProvider() !== 'firstParty') return null
  if (isEssentialTrafficOnly()) return null
  const orgUuid = getGlobalConfig().oauthAccount?.organizationUuid
  if (!orgUuid) return null

  try {
    await checkAndRefreshOAuthTokenIfNeeded()
    const accessToken = getClaudeAIOAuthTokens()?.accessToken
    if (!accessToken) return null

    const url = `${getOauthConfig().BASE_API_URL}/api/organizations/${orgUuid}/claude_code/buddy_react`
    const response = await axios.post<{ reaction?: string }>(
      url,
      {
        name: companion.name.slice(0, 32),
        personality: companion.personality.slice(0, 200),
        species: companion.species,
        rarity: companion.rarity,
        stats: companion.stats,
        transcript: transcript.slice(0, 5000),
        reason,
        recent: recent.map(r => r.slice(0, 200)),
        addressed,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'anthropic-beta': OAUTH_BETA_HEADER,
          'User-Agent': getClaudeCodeUserAgent(),
        },
        timeout: 10_000,
        signal,
      },
    )
    return response.data.reaction?.trim() || null
  } catch (error) {
    logForDebugging(`[buddy] api failed: ${error}`, { level: 'debug' })
    return null
  }
}
