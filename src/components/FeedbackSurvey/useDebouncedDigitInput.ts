import { useEffect, useRef } from 'react'

// Delay before accepting a digit as a response, to prevent accidental
// submissions when users start messages with numbers (e.g., numbered lists).
// Short enough to feel instant for intentional presses, long enough to
// cancel when the user types more characters.
const DEFAULT_DEBOUNCE_MS = 400

// Keystrokes arriving this soon after the input is enabled are ignored, so
// key auto-repeat doesn't submit a response.
const DEFAULT_MOUNT_DELAY_MS = 600

/**
 * Detects when the user types a single valid digit into the prompt input,
 * debounces to avoid accidental submissions (e.g., "1. First item"),
 * trims the digit from the input, and fires a callback.
 *
 * Used by survey components that accept numeric responses typed directly
 * into the main prompt input.
 */
export function useDebouncedDigitInput<T extends string = string>({
  inputValue,
  setInputValue,
  isValidDigit,
  onDigit,
  enabled = true,
  once = false,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  mountDelayMs = DEFAULT_MOUNT_DELAY_MS,
}: {
  inputValue: string
  setInputValue: (value: string) => void
  isValidDigit: (char: string) => char is T
  onDigit: (digit: T) => void
  enabled?: boolean
  once?: boolean
  debounceMs?: number
  mountDelayMs?: number
}): void {
  const initialInputValue = useRef(inputValue)
  const hasTriggeredRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When the input became enabled; restarted each time it is re-enabled
  const enabledAtRef = useRef<number | null>(enabled ? Date.now() : null)
  const wasEnabledRef = useRef(enabled)
  if (enabled && !wasEnabledRef.current) {
    enabledAtRef.current = Date.now()
  }
  wasEnabledRef.current = enabled

  // Latest-ref pattern so callers can pass inline callbacks without causing
  // the effect to re-run (which would reset the debounce timer every render).
  const callbacksRef = useRef({ setInputValue, isValidDigit, onDigit })
  callbacksRef.current = { setInputValue, isValidDigit, onDigit }

  useEffect(() => {
    if (!enabled || (once && hasTriggeredRef.current)) {
      return
    }

    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (
      enabledAtRef.current !== null &&
      Date.now() - enabledAtRef.current < mountDelayMs
    ) {
      return
    }

    if (inputValue !== initialInputValue.current) {
      const lastChar = inputValue.slice(-1).normalize('NFKC')
      if (callbacksRef.current.isValidDigit(lastChar)) {
        const trimmed = inputValue.slice(0, -1)
        debounceRef.current = setTimeout(
          (debounceRef, hasTriggeredRef, callbacksRef, trimmed, lastChar) => {
            debounceRef.current = null
            hasTriggeredRef.current = true
            callbacksRef.current.setInputValue(trimmed)
            callbacksRef.current.onDigit(lastChar)
          },
          debounceMs,
          debounceRef,
          hasTriggeredRef,
          callbacksRef,
          trimmed,
          lastChar,
        )
      }
    }

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [inputValue, enabled, once, debounceMs, mountDelayMs])
}
