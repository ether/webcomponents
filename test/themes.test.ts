import { describe, expect, it } from 'vitest';
import { defineTheme, getTheme, isDark, onThemeDefined, parseColor, themeToCss, themes } from '../src/themes.js';

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

  it('themeToCss renders a rule', () => {
    expect(themeToCss({ '--primary-color': 'red', '--radius': '4px' }, '.x')).toBe(
      '.x {\n  --primary-color: red;\n  --radius: 4px;\n}',
    );
    expect(themeToCss('colibris')).toContain('--primary-color: #64d29b;');
    expect(() => themeToCss('nope')).toThrow(/unknown theme/);
  });

  it('themeToCss rejects unsafe names and values instead of stripping them', () => {
    expect(() => themeToCss({ '--primary-color': 'red; } body { display:none' })).toThrow(/invalid value/);
    expect(() => themeToCss({ '--x': '</style><script>' })).toThrow(/invalid value/);
    expect(() => themeToCss({ '--x': 'a\\62 ' })).toThrow(/invalid value/);
    expect(() => themeToCss({ ['--x} body{' as '--x']: 'red' })).toThrow(/invalid token name/);
    expect(() => themeToCss({ ['color' as '--x']: 'red' })).toThrow(/invalid token name/);
  });

  it('parseColor understands hex, rgb() and some names', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#00000080')).toEqual([0, 0, 0]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    expect(parseColor('rgba(10 20 30 / 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual([255, 0, 0]);
    expect(parseColor('Black')).toEqual([0, 0, 0]);
    expect(parseColor('hsl(0 0% 0%)')).toBeUndefined();
  });

  it('isDark looks at the background colour', () => {
    expect(isDark(themes.colibris)).toBe(false);
    expect(isDark(themes['colibris-dark'])).toBe(true);
    expect(isDark({ '--bg-color': 'black' })).toBe(true);
    expect(isDark({ '--bg-color': 'rgb(0, 0, 0)' })).toBe(true);
    expect(isDark({ '--bg-color': 'hsl(0 0% 0%)' })).toBe(false);
    expect(isDark({ '--bg-color': 'hsl(0 0% 0%)' }, 'rgb(0, 0, 0)')).toBe(true);
    expect(isDark({ '--bg-color': 'white', '--color-scheme': 'dark' })).toBe(true);
    expect(isDark({ '--bg-color': '#000', '--color-scheme': 'light' })).toBe(false);
  });
});
