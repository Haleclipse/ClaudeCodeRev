import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'

type UltraplanConfig = {
  enabled?: boolean
}

/**
 * Runtime gate for ultraplan (GrowthBook tengu_ultraplan_config). Gates the
 * /ultraplan command, the keyword trigger and its prompt highlight, and the
 * ExitPlanMode "Ultraplan" option.
 */
export function isUltraplanEnabled(): boolean {
  return (
    getFeatureValue_CACHED_MAY_BE_STALE<UltraplanConfig | null>(
      'tengu_ultraplan_config',
      null,
    )?.enabled === true
  )
}
