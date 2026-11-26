import React, { useMemo, useState } from 'react'
import type {
  CommandResultDisplay,
  LocalJSXCommandContext,
} from '../../commands.js'
import {
  type OptionWithDescription,
  Select,
} from '../../components/CustomSelect/select.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { logEvent } from '../../services/analytics/index.js'
import { useClaudeAiLimits } from '../../services/claudeAiLimitsHook.js'
import type { ToolUseContext } from '../../Tool.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  getOauthAccountInfo,
  getRateLimitTier,
  getSubscriptionType,
} from '../../utils/auth.js'
import { hasClaudeAiBillingAccess } from '../../utils/billing.js'
import { call as extraUsageCall } from '../extra-usage/extra-usage.js'
import { extraUsage } from '../extra-usage/index.js'
import upgrade from '../upgrade/index.js'
import { call as upgradeCall } from '../upgrade/upgrade.js'

type RateLimitOptionsMenuOptionType = 'upgrade' | 'extra-usage' | 'cancel'

type RateLimitOptionsMenuProps = {
  onDone: (
    result?: string,
    options?:
      | {
          display?: CommandResultDisplay | undefined
        }
      | undefined,
  ) => void
  context: ToolUseContext & LocalJSXCommandContext
}

function RateLimitOptionsMenu({
  onDone,
  context,
}: RateLimitOptionsMenuProps): React.ReactNode {
  const [subCommandJSX, setSubCommandJSX] = useState<React.ReactNode>(null)
  const claudeAiLimits = useClaudeAiLimits()
  const subscriptionType = getSubscriptionType()
  const rateLimitTier = getRateLimitTier()
  const hasExtraUsageEnabled =
    getOauthAccountInfo()?.hasExtraUsageEnabled === true
  const isMax = subscriptionType === 'max'
  const isMax20x = isMax && rateLimitTier === 'default_claude_max_20x'
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'
  const buyFirst = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_jade_anvil_4',
    false,
  )
  // Upgrade paths the server offers (rate-limit response header); when
  // present they decide which actions are shown.
  const upgradePaths = claudeAiLimits.upgradePaths

  const options = useMemo<
    OptionWithDescription<RateLimitOptionsMenuOptionType>[]
  >(() => {
    const actionOptions: OptionWithDescription<RateLimitOptionsMenuOptionType>[] =
      []
    const serverDriven = upgradePaths !== undefined

    if (extraUsage.isEnabled()) {
      const hasBillingAccess = hasClaudeAiBillingAccess()
      const needsToRequestFromAdmin = isTeamOrEnterprise && !hasBillingAccess
      let showExtraUsage: boolean
      if (serverDriven) {
        showExtraUsage = upgradePaths.includes('overage')
      } else {
        // Org spend cap depleted - non-admins can't request more since there's nothing to allocate
        // - out_of_credits: wallet empty
        // - org_level_disabled_until: org spend cap hit for the month
        // - org_service_zero_credit_limit: org service has zero credit limit
        const isOrgSpendCapDepleted =
          claudeAiLimits.overageDisabledReason === 'out_of_credits' ||
          claudeAiLimits.overageDisabledReason === 'org_level_disabled_until' ||
          claudeAiLimits.overageDisabledReason ===
            'org_service_zero_credit_limit'
        // Hide for non-admin Team/Enterprise users when org spend cap is depleted
        showExtraUsage = !(needsToRequestFromAdmin && isOrgSpendCapDepleted)
      }

      if (showExtraUsage) {
        const isOverageState =
          claudeAiLimits.overageStatus === 'rejected' ||
          claudeAiLimits.overageStatus === 'allowed_warning'

        let label: string
        if (needsToRequestFromAdmin) {
          label = isOverageState ? 'Request more' : 'Request extra usage'
        } else {
          label = hasExtraUsageEnabled
            ? 'Add funds to continue with extra usage'
            : 'Switch to extra usage'
        }

        actionOptions.push({
          label,
          value: 'extra-usage',
        })
      }
    }

    if (
      serverDriven
        ? upgradePaths.includes('upgrade_plan') && upgrade.isEnabled()
        : !isMax20x && !isTeamOrEnterprise && upgrade.isEnabled()
    ) {
      actionOptions.push({
        label: 'Upgrade your plan',
        value: 'upgrade',
      })
    }

    const cancelOption: OptionWithDescription<RateLimitOptionsMenuOptionType> =
      {
        label: 'Stop and wait for limit to reset',
        value: 'cancel',
      }

    if (buyFirst) {
      return [...actionOptions, cancelOption]
    }
    return [cancelOption, ...actionOptions]
  }, [
    buyFirst,
    isMax20x,
    isTeamOrEnterprise,
    hasExtraUsageEnabled,
    claudeAiLimits.overageStatus,
    claudeAiLimits.overageDisabledReason,
    upgradePaths,
  ])

  function handleCancel(): void {
    logEvent('tengu_rate_limit_options_menu_cancel', {})
    onDone(undefined, { display: 'skip' })
  }

  function handleSelect(value: RateLimitOptionsMenuOptionType): void {
    if (value === 'upgrade') {
      logEvent('tengu_rate_limit_options_menu_select_upgrade', {})
      void upgradeCall(onDone, context).then(jsx => {
        if (jsx) {
          setSubCommandJSX(jsx)
        }
      })
    } else if (value === 'extra-usage') {
      logEvent('tengu_rate_limit_options_menu_select_extra_usage', {})
      void extraUsageCall(onDone, context).then(jsx => {
        if (jsx) {
          setSubCommandJSX(jsx)
        }
      })
    } else if (value === 'cancel') {
      handleCancel()
    }
  }

  if (subCommandJSX) {
    return subCommandJSX
  }

  return (
    <Dialog
      title="What do you want to do?"
      onCancel={handleCancel}
      color="suggestion"
    >
      <Select<RateLimitOptionsMenuOptionType>
        options={options}
        onChange={handleSelect}
        visibleOptionCount={options.length}
      />
    </Dialog>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <RateLimitOptionsMenu onDone={onDone} context={context} />
}
