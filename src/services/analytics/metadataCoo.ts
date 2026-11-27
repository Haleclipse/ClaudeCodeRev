import { getCooEnvironment } from '../../utils/envUtils.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from './index.js'

/**
 * Spreadable helper for logEvent payloads — {cooNamespace, cooCluster} when
 * known (see getCooEnvironment), empty object otherwise.
 */
export function getCooAnalyticsFields(): {
  cooNamespace?: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  cooCluster?: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
} {
  const { namespace, cluster } = getCooEnvironment()
  return {
    ...(namespace && {
      cooNamespace:
        namespace as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
    ...(cluster && {
      cooCluster:
        cluster as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
  }
}
