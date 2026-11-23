export interface ThemeTokens {
  '--bg-color': string;
  '--bg-soft-color': string;
  '--text-color': string;
  '--text-soft-color': string;
  '--middle-color': string;
  '--dark-color': string;
  '--super-dark-color': string;
  '--light-color': string;
  '--super-light-color': string;
  '--primary-color': string;
  '--main-font-family': string;
  /** Text colour on top of `--primary-color` (primary buttons, badges). */
  '--primary-text-color'?: string;
  /** Errors, destructive actions. */
  '--danger-color'?: string;
  /** Success notices. */
  '--success-color'?: string;
  /** Warnings. */
  '--warning-color'?: string;
  /** Focus ring colour. */
  '--focus-color'?: string;
  /** Corner radius of buttons; inputs and selects use 1px less. */
  '--radius'?: string;
  /** Corner radius of surfaces (cards, dialogs, menus, toasts). */
  '--radius-large'?: string;
  /** `light` or `dark`; overrides the detection from `--bg-color`. */
  '--color-scheme'?: string;
  /** Elevation of floating surfaces. */
  '--shadow'?: string;
  /** Allows extra, app-specific tokens (`--my-token`). */
  [token: `--${string}`]: string | undefined;
}

/** Name of the theme used when nothing else is selected. */
export const DEFAULT_THEME = 'colibris';

const SHADOW = '0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08)';
const SHADOW_DARK = '0 0 0 1px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.35)';


/** Registry of all known themes. Prefer `defineTheme` for adding new ones. */
export const themes: Record<string, ThemeTokens> = {
  colibris: {
    '--bg-color': 'white',
    '--bg-soft-color': '#f2f3f4',
    '--text-color': '#485365',
    '--text-soft-color': '#576273',
    '--middle-color': '#d2d2d2',
    '--dark-color': '#576273',
    '--super-dark-color': '#485365',
    '--light-color': '#f2f3f4',
    '--super-light-color': 'white',
    '--primary-color': '#64d29b',
    '--main-font-family': 'Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    '--primary-text-color': 'white',
    '--danger-color': '#d1242f',
    '--success-color': '#64d29b',
    '--warning-color': '#d4a72c',
    '--focus-color': '#576273',
    '--radius': '4px',
    '--radius-large': '5px',
    '--shadow': SHADOW,
  },

  'colibris-dark': {
    '--bg-color': '#2c3143',
    '--bg-soft-color': '#363b50',
    '--text-color': '#e4e6eb',
    '--text-soft-color': '#a8adb8',
    '--middle-color': '#4a5068',
    '--dark-color': '#a8adb8',
    '--super-dark-color': '#e4e6eb',
    '--light-color': '#363b50',
    '--super-light-color': '#2c3143',
    '--primary-color': '#64d29b',
    '--main-font-family': 'Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    '--primary-text-color': '#2c3143',
    '--danger-color': '#ff6b6b',
    '--success-color': '#64d29b',
    '--warning-color': '#e3b341',
    '--focus-color': '#a8adb8',
    '--radius': '4px',
    '--radius-large': '5px',
    '--shadow': SHADOW_DARK,
  },

  'high-contrast': {
    '--bg-color': 'white',
    '--bg-soft-color': '#f5f5f5',
    '--text-color': '#111111',
    '--text-soft-color': '#333333',
    '--middle-color': '#999999',
    '--dark-color': '#333333',
    '--super-dark-color': '#111111',
    '--light-color': '#f5f5f5',
    '--super-light-color': 'white',
    '--primary-color': '#0066cc',
    '--main-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '--primary-text-color': 'white',
    '--danger-color': '#b00020',
    '--success-color': '#006b2e',
    '--warning-color': '#8a5a00',
    '--focus-color': '#111111',
    '--radius': '4px',
    '--radius-large': '5px',
    '--shadow': SHADOW,
  },

  warm: {
    '--bg-color': '#fdfbf7',
    '--bg-soft-color': '#f5f0e8',
    '--text-color': '#4a3f35',
    '--text-soft-color': '#7a6e62',
    '--middle-color': '#d6cfc5',
    '--dark-color': '#7a6e62',
    '--super-dark-color': '#4a3f35',
    '--light-color': '#f5f0e8',
    '--super-light-color': '#fdfbf7',
    '--primary-color': '#c47a4a',
    '--main-font-family': 'Georgia, "Times New Roman", serif',
    '--primary-text-color': '#fdfbf7',
    '--danger-color': '#b3261e',
    '--success-color': '#5a8a3c',
    '--warning-color': '#b7791f',
    '--focus-color': '#7a6e62',
    '--radius': '4px',
    '--radius-large': '5px',
    '--shadow': SHADOW,
  },
};

/**
 * Registers a theme. Tokens that are not given are taken from `base`
 * (default: colibris), so a theme only has to state what differs – e.g. a
 * different accent colour:
 *
 *   defineTheme('acme', { '--primary-color': '#7c3aed' });
 *
 * Returns the complete token set.
 */
export function defineTheme(
  name: string,
  tokens: Partial<ThemeTokens>,
  base: string = DEFAULT_THEME,
): ThemeTokens {
  const parent = themes[base];
  if (!parent) throw new Error(`ep-theme: unknown base theme "${base}"`);
  const merged = { ...parent } as ThemeTokens;
  for (const [k, v] of Object.entries(tokens)) {
    if (v !== undefined) merged[k as keyof ThemeTokens] = v as never;
  }
  themes[name] = merged;
  notifyThemeChanged(name);
  return merged;
}

/** Returns the tokens of a theme, or undefined if it is unknown. */
export function getTheme(name: string): ThemeTokens | undefined {
  return themes[name];
}

const TOKEN_NAME = /^--[a-zA-Z0-9_-]+$/;
const UNSAFE_VALUE = /[;{}<>\\]/;

/**
 * Renders a theme as plain CSS (`selector { --token: value; … }`), for pages
 * that set tokens on `:root` – or server-side – instead of using `<ep-theme>`.
 *
 * Token names must look like `--name`, and values must not contain
 * `; { } < > \`; anything else throws instead of producing broken or
 * injectable CSS. The selector is written as given and must be trusted.
 */
export function themeToCss(theme: string | Partial<ThemeTokens>, selector = ':root'): string {
  const tokens = typeof theme === 'string' ? themes[theme] : theme;
  if (!tokens) throw new Error(`ep-theme: unknown theme "${theme}"`);
  const body = Object.entries(tokens)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      if (!TOKEN_NAME.test(k)) throw new Error(`ep-theme: invalid token name "${k}"`);
      const value = String(v);
      if (UNSAFE_VALUE.test(value)) throw new Error(`ep-theme: invalid value for ${k}`);
      return `  ${k}: ${value};`;
    })
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/**
 * Sets a theme's tokens as inline custom properties on `el` (e.g.
 * `document.documentElement`). Tokens set by an earlier call that the new
 * theme does not define are removed again.
 */
export function applyTheme(el: HTMLElement, theme: string | Partial<ThemeTokens>): void {
  const tokens = typeof theme === 'string' ? themes[theme] : theme;
  if (!tokens) return;
  const previous = applied.get(el) ?? [];
  const next: string[] = [];
  for (const [prop, value] of Object.entries(tokens)) {
    if (value === undefined || value === '') continue;
    el.style.setProperty(prop, String(value));
    next.push(prop);
  }
  for (const prop of previous) {
    if (!next.includes(prop)) el.style.removeProperty(prop);
  }
  applied.set(el, next);
}

const applied = new WeakMap<HTMLElement, string[]>();
const listeners = new Set<(name: string) => void>();

/** Calls `fn` whenever a theme is (re)defined at runtime. Returns an unsubscribe function. */
export function onThemeDefined(fn: (name: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @internal */
export function notifyThemeChanged(name: string) {
  for (const fn of listeners) fn(name);
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255],
  navy: [0, 0, 128], darkslategray: [47, 79, 79], darkslategrey: [47, 79, 79],
  dimgray: [105, 105, 105], dimgrey: [105, 105, 105], gray: [128, 128, 128], grey: [128, 128, 128],
  midnightblue: [25, 25, 112], darkblue: [0, 0, 139], indigo: [75, 0, 130],
  silver: [192, 192, 192], whitesmoke: [245, 245, 245], ivory: [255, 255, 240],
  snow: [255, 250, 250], ghostwhite: [248, 248, 255], linen: [250, 240, 230],
};

/**
 * Parses hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba() and a few named
 * colours. Returns undefined for anything else (hsl(), color-mix(), …); in a
 * browser `<ep-theme>` resolves such values through the CSS engine first.
 */
export function parseColor(value: string): [number, number, number] | undefined {
  const v = value.trim().toLowerCase();
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/.exec(v);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]].map((c) =>
      c.endsWith('%') ? Math.round(parseFloat(c) * 2.55) : Math.round(parseFloat(c)),
    ) as [number, number, number];
  }
  return undefined;
}

/**
 * Whether a theme has a dark background. Uses `--color-scheme` when the theme
 * sets it (`light` / `dark`), otherwise the luminance of `--bg-color`.
 * Unparseable colours count as light.
 */
export function isDark(tokens: Partial<ThemeTokens>, resolvedBg?: string): boolean {
  const scheme = tokens['--color-scheme']?.trim();
  if (scheme === 'dark') return true;
  if (scheme === 'light') return false;
  const rgb = parseColor(resolvedBg ?? tokens['--bg-color'] ?? '');
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}
