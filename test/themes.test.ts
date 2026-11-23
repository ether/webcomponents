import { describe, expect, it } from 'vitest';
import { defineTheme, getTheme, isDark, onThemeDefined, themeToCss, themes } from '../src/themes.js';

describe('themes', () => {
  it('ships colibris as complete default', () => {
    const c = getTheme('colibris')!;
    expect(c['--primary-color']).toBe('#64d29b');
    for (const name of Object.keys(themes)) {
      expect(Object.keys(themes[name]).sort()).toEqual(Object.keys(c).sort());
    }
  });

  it('defineTheme fills missing tokens from the base theme', () => {
    const t = defineTheme('test-accent', { '--primary-color': '#7c3aed' });
    expect(t['--primary-color']).toBe('#7c3aed');
    expect(t['--bg-color']).toBe(themes.colibris['--bg-color']);
    const d = defineTheme('test-accent-dark', { '--primary-color': '#7c3aed' }, 'colibris-dark');
    expect(d['--bg-color']).toBe(themes['colibris-dark']['--bg-color']);
    expect(() => defineTheme('x', {}, 'nope')).toThrow(/unknown base theme/);
  });

  it('defineTheme does not change the base theme', () => {
    defineTheme('test-iso', { '--bg-color': '#000000' });
    expect(themes.colibris['--bg-color']).toBe('white');
  });

  it('notifies listeners about new themes', () => {
    const seen: string[] = [];
    const off = onThemeDefined((n) => seen.push(n));
    defineTheme('test-notify', {});
    off();
    defineTheme('test-notify-2', {});
    expect(seen).toEqual(['test-notify']);
  });

  it('themeToCss renders a rule and strips injection characters', () => {
    const css = themeToCss({ '--primary-color': 'red; } body { display:none' }, '.x');
    expect(css).toBe('.x {\n  --primary-color: red  body  display:none;\n}');
    expect(themeToCss('colibris')).toContain('--primary-color: #64d29b;');
    expect(() => themeToCss('nope')).toThrow(/unknown theme/);
  });

  it('isDark looks at the background colour', () => {
    expect(isDark(themes.colibris)).toBe(false);
    expect(isDark(themes['colibris-dark'])).toBe(true);
  });
});
