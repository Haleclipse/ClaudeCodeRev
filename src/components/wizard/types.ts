// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type WizardStepComponent<T = any> = React.ComponentType<{ data: T; onNext: (data: Partial<T>) => void; onBack: () => void }>
export type WizardContextValue<T = any> = {
  data: T; step: number; totalSteps: number
  next: (data?: Partial<T>) => void; back: () => void; cancel: () => void
  goNext: (data?: Partial<T>) => void; goBack: () => void
  updateWizardData: (data: Partial<T>) => void; wizardData: T
  currentStep: number
}
export type WizardProviderProps<T = any> = { children: React.ReactNode; initialData: T; onComplete: (data: T) => void; onCancel?: () => void }
