import type { Chord, ParsedKeystroke } from './types.js'

/**
 * Display formatting for key chords.
 *
 * - default: Title-case key names joined with "+" ("Ctrl+O", "Shift+Tab")
 * - compact: lowercase names, "^X" for a lone ctrl, shift+letter as an
 *   uppercase letter ("^o", "O")
 * - symbol: glyphs (⏎ ⎋ ⇥, ⌃ ⇧ ⌥ ⌘)
 */
export type ChordFormatStyle = 'default' | 'compact' | 'symbol'

type KeyCase = 'title' | 'lower' | 'glyph'
type Modifier = 'ctrl' | 'shift' | 'alt' | 'super'
type FormatPlatform = 'macos' | 'other'

export type ChordFormatOptions = {
  keyCase: KeyCase
  modCase: KeyCase
  /** Render a lone ctrl modifier as "^X" */
  caretCtrl: boolean
  modSep: string
  /** Separator between alternative arrow keys ("↑/↓", "↑↓") */
  arrowSep: string
  /** Separator between the steps of a multi-keystroke chord */
  chordSep: string
  /** Render shift+letter as the uppercase letter */
  shiftAsCase: boolean
  charCase: 'preserve' | 'upper'
  platform: FormatPlatform
}

export type ChordFormat = Partial<ChordFormatOptions> & {
  style?: ChordFormatStyle
}

const STYLE_PRESETS: Record<ChordFormatStyle, ChordFormatOptions> = {
  default: {
    keyCase: 'title',
    modCase: 'lower',
    caretCtrl: false,
    modSep: '+',
    arrowSep: '/',
    chordSep: ' ',
    shiftAsCase: false,
    charCase: 'preserve',
    platform: 'other',
  },
  compact: {
    keyCase: 'lower',
    modCase: 'lower',
    caretCtrl: true,
    modSep: '+',
    arrowSep: '',
    chordSep: ' ',
    shiftAsCase: true,
    charCase: 'preserve',
    platform: 'other',
  },
  symbol: {
    keyCase: 'glyph',
    modCase: 'glyph',
    caretCtrl: false,
    modSep: '',
    arrowSep: '',
    chordSep: ' ',
    shiftAsCase: true,
    charCase: 'upper',
    platform: 'other',
  },
}

function resolveFormatOptions(format: ChordFormat): ChordFormatOptions {
  const { style, ...overrides } = format
  return { ...STYLE_PRESETS[style ?? 'default'], ...dropUndefined(overrides) }
}

function dropUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key]
  }
  return out
}

/**
 * Format one or more chords for display. Alternatives are joined with "/";
 * single-keystroke alternatives that share their modifiers print the
 * modifiers once ("ctrl+j/k"), and arrow keys collapse ("↑/↓").
 */
export function formatChords(chords: Chord[], format: ChordFormat = {}): string {
  const opts = resolveFormatOptions(format)
  const keystroke = (ks: ParsedKeystroke) => formatKeystroke(ks, opts)
  const chord = (c: Chord) => c.map(keystroke).join(opts.chordSep)
  if (chords.length === 0) return ''
  if (chords.length === 1) return chord(chords[0]!)
  const singles = chords.every(c => c.length === 1)
    ? chords.map(c => c[0]!)
    : undefined
  if (!singles) return chords.map(chord).join('/')
  const shared = sharedModifierKeystroke(singles, opts)
  const sep =
    singles.every(ks => ARROW_KEYS.has(ks.key)) &&
    (!!shared || singles.every(ks => effectiveModifiers(ks, opts).length === 0))
      ? opts.arrowSep
      : '/'
  if (shared) {
    const keys = singles.map(ks => keystroke({ ...ks, ...NO_MODIFIERS }))
    return formatModifierPrefix(shared, opts) + keys.join(sep)
  }
  return singles.map(keystroke).join(sep)
}

const KEY_LABELS: Record<string, [string, string, string]> = {
  enter: ['Enter', 'enter', '⏎'],
  escape: ['Esc', 'esc', '⎋'],
  tab: ['Tab', 'tab', '⇥'],
  ' ': ['Space', 'space', '␣'],
  backspace: ['Backspace', 'backspace', '⌫'],
  delete: ['Delete', 'delete', '⌦'],
  up: ['↑', '↑', '↑'],
  down: ['↓', '↓', '↓'],
  left: ['←', '←', '←'],
  right: ['→', '→', '→'],
  pageup: ['PageUp', 'pgup', '⇞'],
  pagedown: ['PageDown', 'pgdn', '⇟'],
  home: ['Home', 'home', '↖'],
  end: ['End', 'end', '↘'],
}
const KEY_CASE_INDEX: Record<KeyCase, number> = {
  title: 0,
  lower: 1,
  glyph: 2,
}
const MODIFIER_LABELS: Record<
  Modifier,
  Record<KeyCase, string | ((platform: FormatPlatform) => string)>
> = {
  ctrl: { lower: 'ctrl', title: 'Ctrl', glyph: '⌃' },
  shift: { lower: 'shift', title: 'Shift', glyph: '⇧' },
  alt: {
    lower: platform => (platform === 'macos' ? 'opt' : 'alt'),
    title: platform => (platform === 'macos' ? 'Opt' : 'Alt'),
    glyph: '⌥',
  },
  super: {
    lower: platform => (platform === 'macos' ? 'cmd' : 'super'),
    title: platform => (platform === 'macos' ? 'Cmd' : 'Super'),
    glyph: '⌘',
  },
}
const ARROW_KEYS = new Set(['up', 'down', 'left', 'right'])
const NO_MODIFIERS = {
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
  super: false,
}

function modifiersOf(ks: ParsedKeystroke): Modifier[] {
  const mods: Modifier[] = []
  if (ks.ctrl) mods.push('ctrl')
  if (ks.shift) mods.push('shift')
  if (ks.alt || ks.meta) mods.push('alt')
  if (ks.super) mods.push('super')
  return mods
}

function modifierLabel(mod: Modifier, opts: ChordFormatOptions): string {
  const label = MODIFIER_LABELS[mod][opts.modCase]
  return typeof label === 'function' ? label(opts.platform) : label
}

function keyLabel(key: string, opts: ChordFormatOptions): string {
  const labels = KEY_LABELS[key]
  if (labels) return labels[KEY_CASE_INDEX[opts.keyCase]]!
  return opts.charCase === 'upper' ? key.toUpperCase() : key
}

function isShiftedLetter(ks: ParsedKeystroke): boolean {
  return (
    ks.shift &&
    !ks.ctrl &&
    !ks.alt &&
    !ks.meta &&
    !ks.super &&
    ks.key.length === 1 &&
    ks.key >= 'a' &&
    ks.key <= 'z'
  )
}

function formatKeystroke(ks: ParsedKeystroke, opts: ChordFormatOptions): string {
  if (opts.shiftAsCase && isShiftedLetter(ks)) return ks.key.toUpperCase()
  const mods = modifiersOf(ks)
  const key = keyLabel(ks.key, opts)
  if (opts.caretCtrl && mods.length === 1 && mods[0] === 'ctrl') return `^${key}`
  if (opts.modCase === 'glyph') {
    return mods.map(mod => modifierLabel(mod, opts)).join('') + key
  }
  return [...mods.map(mod => modifierLabel(mod, opts)), key].join(opts.modSep)
}

// The first keystroke, when every keystroke carries exactly its modifiers
function sharedModifierKeystroke(
  keystrokes: ParsedKeystroke[],
  opts: ChordFormatOptions,
): ParsedKeystroke | undefined {
  const [first, ...rest] = keystrokes
  if (!effectiveModifiers(first!, opts).length) return
  return rest.every(ks => sameModifiers(first!, ks, opts)) ? first : undefined
}

// Modifiers that are printed (shift+letter prints as the uppercase letter)
function effectiveModifiers(
  ks: ParsedKeystroke,
  opts: ChordFormatOptions,
): Modifier[] {
  if (opts.shiftAsCase && isShiftedLetter(ks)) return []
  return modifiersOf(ks)
}

function sameModifiers(
  a: ParsedKeystroke,
  b: ParsedKeystroke,
  opts: ChordFormatOptions,
): boolean {
  const am = effectiveModifiers(a, opts)
  const bm = effectiveModifiers(b, opts)
  return am.length === bm.length && am.every((mod, i) => mod === bm[i])
}

function formatModifierPrefix(
  ks: ParsedKeystroke,
  opts: ChordFormatOptions,
): string {
  const mods = modifiersOf(ks)
  if (opts.caretCtrl && mods.length === 1 && mods[0] === 'ctrl') return '^'
  if (opts.modCase === 'glyph') {
    return mods.map(mod => modifierLabel(mod, opts)).join('')
  }
  return mods.map(mod => modifierLabel(mod, opts)).join(opts.modSep) + opts.modSep
}
