import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'

/**
 * Relative-path prompting (GrowthBook tengu_relpath_gh7k): file tools may take
 * cwd-relative paths and Bash is steered away from `cd`. Prompt text only.
 */
export function isRelativePathsEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_relpath_gh7k', false)
}
