/**
 * Listeners for terminal theme-change reports (DEC private mode 2031; the
 * terminal answers CSI ? 997 ; 1|2 n when it switches dark/light). The App
 * enables the mode in raw mode and calls notifyTerminalThemeChange on each
 * report.
 */
export const terminalThemeListeners = new Set<() => void>()

export function notifyTerminalThemeChange(): void {
  for (const listener of terminalThemeListeners) listener()
}
