// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type FeedbackSurveyType = 'general' | 'post_compact' | 'memory' | 'skill_improvement'
export type FeedbackSurveyResponse = { type: FeedbackSurveyType; rating?: number; comment?: string; sessionId?: string }
