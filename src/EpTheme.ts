import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
}

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
  },
};

@customElement('ep-theme')
export class EpTheme extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ reflect: true }) name: string = 'colibris';

  updated(changed: Map<string, unknown>) {
    if (changed.has('name')) {
      this._applyTokens();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._applyTokens();
  }

  private _applyTokens() {
    const tokens = themes[this.name];
    if (!tokens) return;

    for (const [prop, value] of Object.entries(tokens)) {
      this.style.setProperty(prop, value);
    }
  }

  render() {
    return html`<slot></slot>`;
  }

  /** Register a custom theme at runtime. */
  static registerTheme(name: string, tokens: ThemeTokens) {
    themes[name] = tokens;
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
