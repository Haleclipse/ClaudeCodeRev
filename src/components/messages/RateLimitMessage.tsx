import React, { useEffect, useMemo, useState } from 'react'
import { extraUsage } from 'src/commands/extra-usage/index.js'
import { Box, Text } from 'src/ink.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'
import { useClaudeAiLimits } from 'src/services/claudeAiLimitsHook.js'
import { shouldProcessMockLimits } from 'src/services/rateLimitMocking.js' // Used for /mock-limits command
import {
  getRateLimitTier,
  getSubscriptionType,
  isClaudeAISubscriber,
} from 'src/utils/auth.js'
import { hasClaudeAiBillingAccess } from 'src/utils/billing.js'
import { MessageResponse } from '../MessageResponse.js'

type UpsellParams = {
  shouldShowUpsell: boolean
  isMax20x: boolean
  isExtraUsageCommandEnabled: boolean
  shouldAutoOpenRateLimitOptionsMenu: boolean
  isTeamOrEnterprise: boolean
  hasBillingAccess: boolean
}

export function getUpsellMessage({
  shouldShowUpsell,
  isMax20x,
  isExtraUsageCommandEnabled,
  shouldAutoOpenRateLimitOptionsMenu,
  isTeamOrEnterprise,
  hasBillingAccess,
}: UpsellParams): string | null {
  if (!shouldShowUpsell) return null

  if (isMax20x) {
    if (isExtraUsageCommandEnabled) {
      return '/extra-usage to finish what you\u2019re working on.'
    }
    return '/login to switch to an API usage-billed account.'
  }

  if (shouldAutoOpenRateLimitOptionsMenu) {
    return 'Opening your options\u2026'
  }

  if (!isTeamOrEnterprise && !isExtraUsageCommandEnabled) {
    return '/upgrade to increase your usage limit.'
  }

  if (isTeamOrEnterprise) {
    if (!isExtraUsageCommandEnabled) return null

    if (hasBillingAccess) {
      return '/extra-usage to finish what you\u2019re working on.'
    }

    return '/extra-usage to request more usage from your admin.'
  }

  return '/upgrade or /extra-usage to finish what you\u2019re working on.'
}

type RateLimitMessageProps = {
  text: string
  onOpenRateLimitOptions?: () => void
}

export function RateLimitMessage({
  text,
  onOpenRateLimitOptions,
}: RateLimitMessageProps): React.ReactNode {
  const subscriptionType = getSubscriptionType()
  const rateLimitTier = getRateLimitTier()
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'
  // tengu_slate_harbor: upgrades unavailable — treat everyone like the top
  // tier so no upgrade upsell is shown
  const upgradeUnavailable = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_slate_harbor',
    false,
  )
  const isMax20x =
    rateLimitTier === 'default_claude_max_20x' || upgradeUnavailable
  // Always show upsell when using /mock-limits command, otherwise show for subscribers
  const shouldShowUpsell = shouldProcessMockLimits() || isClaudeAISubscriber()

  const canSeeRateLimitOptionsUpsell = shouldShowUpsell && !isMax20x

  const [hasOpenedInteractiveMenu, setHasOpenedInteractiveMenu] =
    useState(false)

  // Check actual rate limit status - only auto-open if user is currently rate limited
  // AND we've verified this with the API (resetsAt is only set after API response).
  // This prevents false alerts when resuming sessions with old rate limit messages.
  const claudeAiLimits = useClaudeAiLimits()
  const isCurrentlyRateLimited =
    claudeAiLimits.status === 'rejected' &&
    claudeAiLimits.resetsAt !== undefined &&
    !claudeAiLimits.isUsingOverage

  const shouldAutoOpenRateLimitOptionsMenu =
    canSeeRateLimitOptionsUpsell &&
    !hasOpenedInteractiveMenu &&
    isCurrentlyRateLimited &&
    onOpenRateLimitOptions

  useEffect(() => {
    if (shouldAutoOpenRateLimitOptionsMenu) {
      setHasOpenedInteractiveMenu(true)
      onOpenRateLimitOptions()
    }
  }, [shouldAutoOpenRateLimitOptionsMenu, onOpenRateLimitOptions])

  const upsell = useMemo(() => {
    const message = getUpsellMessage({
      shouldShowUpsell,
      isMax20x,
      isExtraUsageCommandEnabled: extraUsage.isEnabled(),
      shouldAutoOpenRateLimitOptionsMenu: !!shouldAutoOpenRateLimitOptionsMenu,
      isTeamOrEnterprise,
      hasBillingAccess: hasClaudeAiBillingAccess(),
    })
    if (!message) return null
    return <Text dimColor>{message}</Text>
  }, [
    shouldShowUpsell,
    isMax20x,
    isTeamOrEnterprise,
    shouldAutoOpenRateLimitOptionsMenu,
  ])

  return (
    <MessageResponse>
      <Box flexDirection="column">
        <Text color="error">{text}</Text>
        {hasOpenedInteractiveMenu ? null : upsell}
      </Box>
    </MessageResponse>
  )
}
