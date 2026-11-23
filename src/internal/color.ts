import { parseColor } from '../themes.js';

/**
 * Black or white, whichever reads better on `bg` (WCAG relative luminance).
 * Falls back to white for colours that cannot be parsed.
 */
export function readableTextOn(bg: string, dark = '#1f2328', light = '#ffffff'): string {
  const rgb = parseColor(bg);
  if (!rgb) return light;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against white vs. against near-black.
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? light : dark;
}

/** Up to two initials of a name ("Ada Lovelace" → "AL", "sam" → "S"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0] ?? '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * Returns `value` if it is a single valid CSS colour, otherwise undefined.
 * Colours often come from other users (author colours), and Lit's styleMap
 * writes the first render as a style string, so a value like
 * `red;background:url(…)` must not get through.
 */
export function safeColor(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!v || /[;{}<>\\]/.test(v)) return undefined;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', v)) {
    return undefined;
  }
  return v;
}
