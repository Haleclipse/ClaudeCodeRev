// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type WizardStepComponent<T = any> = React.ComponentType<any>
export type WizardContextValue<T = any> = {
  currentStepIndex: number; totalSteps: number
  wizardData: T; setWizardData: React.Dispatch<React.SetStateAction<T>>
  updateWizardData: (updates: Partial<T>) => void
  goNext: () => void; goBack: () => void; goToStep: (index: number) => void; cancel: () => void
  title?: string; showStepCounter?: boolean
}
export type WizardProviderProps<T = any> = {
  steps: WizardStepComponent<T>[]; initialData?: T; onComplete: (data: T) => void | Promise<void>; onCancel?: () => void
  children?: React.ReactNode; title?: string; showStepCounter?: boolean
}
