// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type BillingType = 'free' | 'pro' | 'team' | 'enterprise'
export type SubscriptionType = 'free' | 'pro' | 'team' | 'enterprise'
export type RateLimitTier = 'free' | 'pro' | 'enterprise'

export type OAuthTokens = {
  accessToken: string; refreshToken?: string; expiresAt?: number; tokenType?: string
  scopes?: string[]; subscriptionType?: SubscriptionType; billingType?: BillingType
  rateLimitTier?: RateLimitTier; accountUuid?: string; organizationId?: string
  organizationName?: string; email?: string
}

export type OAuthProfileResponse = {
  id: string; email: string; name: string; accountUuid: string
  subscriptionType: SubscriptionType; billingType: BillingType; rateLimitTier: RateLimitTier
  organizationId?: string; organizationName?: string; [key: string]: unknown
}

export type OAuthTokenExchangeResponse = { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }

export type ReferralEligibilityResponse = { eligible: boolean; reason?: string }
export type ReferrerRewardInfo = { amount?: number; currency?: string }
export type ReferralRedemptionsResponse = { redemptions: unknown[] }
export type ReferralCampaign = { id: string; name: string; active: boolean }
export type UserRolesResponse = { roles: string[] }
