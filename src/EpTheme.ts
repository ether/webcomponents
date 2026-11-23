import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  DEFAULT_THEME, applyTheme, isDark, notifyThemeChanged, onThemeDefined, themes,
} from './themes.js';
import type { ThemeTokens } from './themes.js';

export * from './themes.js';

@customElement('ep-theme')
export class EpTheme extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  /**
   * Theme to apply. `auto` follows the operating system and picks `light`
   * or `dark`.
   */
  @property({ reflect: true }) name: string = DEFAULT_THEME;

  /** Theme used by `name="auto"` in light mode. */
  @property() light: string = DEFAULT_THEME;

  /** Theme used by `name="auto"` in dark mode. */
  @property() dark: string = 'colibris-dark';

  /** Single tokens on top of the theme, e.g. `{ '--primary-color': '#7c3aed' }`. */
  @property({ attribute: false }) tokens: Partial<ThemeTokens> = {};

  private _media?: MediaQueryList;
  private _onMedia = () => this._applyTokens();
  private _current = '';
  private _unsubscribe?: () => void;

  /** Theme name actually in use (resolves `auto`). */
  get resolvedName(): string {
    if (this.name !== 'auto') return this.name;
    return this._media?.matches ? this.dark : this.light;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = onThemeDefined((n) => this.themeUpdated(n));
    if (typeof matchMedia === 'function') {
      this._media = matchMedia('(prefers-color-scheme: dark)');
      this._media.addEventListener('change', this._onMedia);
    }
    this._applyTokens();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._media?.removeEventListener('change', this._onMedia);
    this._media = undefined;
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('name') || changed.has('light') || changed.has('dark') || changed.has('tokens')) {
      this._applyTokens();
    }
  }

  /** @internal called when a theme is (re)defined at runtime. */
  themeUpdated(name: string) {
    if (name === this.resolvedName) this._applyTokens();
  }

  private _applyTokens() {
    const name = this.resolvedName;
    const base = themes[name];
    if (!base) {
      console.warn(`ep-theme: unknown theme "${name}"`);
      return;
    }
    applyTheme(this, { ...base, ...this.tokens });
    this.dataset.scheme = isDark(base) ? 'dark' : 'light';
    if (this._current !== name) {
      this._current = name;
      this.dispatchEvent(new CustomEvent('ep-theme-change', {
        bubbles: true, composed: true, detail: { name },
      }));
    }
  }

  render() {
    return html`<slot></slot>`;
  }

  /** Register a custom theme at runtime (full token set). */
  static registerTheme(name: string, tokens: ThemeTokens) {
    themes[name] = tokens;
    notifyThemeChanged(name);
  }

  /** Get all registered theme names. */
  static get themeNames(): string[] {
    return Object.keys(themes);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-theme': EpTheme;
  }
}
