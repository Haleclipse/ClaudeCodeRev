import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNotifications } from 'src/context/notifications.js'
import { Text } from 'src/ink.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import {
  getRateLimitWarning,
  getUsingOverageText,
} from 'src/services/claudeAiLimits.js'
import { useClaudeAiLimits } from 'src/services/claudeAiLimitsHook.js'
import { getRateLimitLeverHint } from 'src/services/rateLimitMessages.js'
import { useAppState } from 'src/state/AppState.js'
import { getSubscriptionType } from 'src/utils/auth.js'
import { hasClaudeAiBillingAccess } from 'src/utils/billing.js'
import { getIsRemoteMode } from '../../bootstrap/state.js'

export function useRateLimitWarningNotification(model: string): void {
  const { addNotification } = useNotifications()
  const claudeAiLimits = useClaudeAiLimits()
  const effortValue = useAppState(s => s.effortValue)
  // claudeAiLimits reference is stable until statusListeners fire (API
  // response), so these skip the Intl formatting work on most REPL renders.
  const rateLimitWarning = useMemo(
    () => getRateLimitWarning(claudeAiLimits, model),
    [claudeAiLimits, model],
  )
  const leverHint = useMemo(
    () => getRateLimitLeverHint(claudeAiLimits, model, effortValue),
    [claudeAiLimits, model, effortValue],
  )
  const usingOverageText = useMemo(
    () => getUsingOverageText(claudeAiLimits),
    [claudeAiLimits],
  )
  const shownWarningRef = useRef<string | null>(null)
  const subscriptionType = getSubscriptionType()
  const hasBillingAccess = hasClaudeAiBillingAccess()
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'

  // Track overage mode transitions
  const [hasShownOverageNotification, setHasShownOverageNotification] =
    useState(false)

  // Show immediate notification when entering overage mode
  useEffect(() => {
    if (getIsRemoteMode()) return
    if (
      claudeAiLimits.isUsingOverage &&
      !hasShownOverageNotification &&
      (!isTeamOrEnterprise || hasBillingAccess)
    ) {
      addNotification({
        key: 'limit-reached',
        text: usingOverageText,
        priority: 'immediate',
      })
      setHasShownOverageNotification(true)
    } else if (!claudeAiLimits.isUsingOverage && hasShownOverageNotification) {
      // Reset when no longer in overage mode
      setHasShownOverageNotification(false)
    }
  }, [
    claudeAiLimits.isUsingOverage,
    usingOverageText,
    hasShownOverageNotification,
    addNotification,
    hasBillingAccess,
    isTeamOrEnterprise,
  ])

  // Show warning notification for approaching limits
  useEffect(() => {
    if (getIsRemoteMode()) return
    if (rateLimitWarning && rateLimitWarning !== shownWarningRef.current) {
      shownWarningRef.current = rateLimitWarning
      addNotification({
        key: 'rate-limit-warning',
        jsx: (
          <Text>
            <Text color="warning">{rateLimitWarning}</Text>
            {leverHint && <Text dimColor> · {leverHint.text}</Text>}
          </Text>
        ),
        priority: 'high',
      })
      if (leverHint) {
        logEvent('tengu_rate_limit_lever_hint', {
          lever:
            leverHint.lever as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
      }
    }
  }, [rateLimitWarning, leverHint, addNotification])
}
