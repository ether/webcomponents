import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const isLightColor = (color: string): boolean => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = color;
    const resolved = ctx.fillStyle;
    let r = 0, g = 0, b = 0;
    if (resolved.startsWith('#')) {
      const hex = resolved.slice(1);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      const match = resolved.match(/\d+/g);
      if (match) {
        r = parseInt(match[0], 10);
        g = parseInt(match[1], 10);
        b = parseInt(match[2], 10);
      }
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  } catch {
    return false;
  }
};

// Etherpad's author colour palette (the pastel tints from
// AuthorManager.getColorPalette) — the same swatches Etherpad offers when
// picking your author colour.
const DEFAULT_COLORS = [
  '#ffc7c7', '#fff1c7', '#e3ffc7', '#c7ffd5', '#c7ffff', '#c7d5ff', '#e3c7ff', '#ffc7f1',
  '#ffa8a8', '#ffe699', '#cfff9e', '#99ffb3', '#a3ffff', '#99b3ff', '#cc99ff', '#ff99e5',
];

@customElement('ep-color-picker')
export class EpColorPicker extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-block;
      font-family: var(--ep-font);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 32px);
      gap: 6px;
      padding: 8px;
      background: var(--bg-color, white);
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: 5px;
      box-shadow: 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08);
    }

    .swatch {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 2px solid transparent;
      cursor: pointer;
      position: relative;
      transition: border-color 0.15s ease, transform 0.1s ease;
      padding: 0;
      background: none;
      outline: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .swatch:hover { transform: scale(1.1); }

    .swatch:focus-visible {
      outline: 2px solid var(--dark-color, #576273);
      outline-offset: 2px;
    }

    .swatch[aria-selected="true"] {
      border-color: var(--text-color, #485365);
    }

    .swatch-inner {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .check {
      display: none;
      width: 14px;
      height: 14px;
    }

    .swatch[aria-selected="true"] .check { display: block; }
  `;

  @property({ type: Array }) colors: string[] = DEFAULT_COLORS;
  @property() value = '';

  render() {
    return html`
      <div class="grid" role="listbox" aria-label="Color picker">
        ${this.colors.map((color, i) => this._renderSwatch(color, i))}
      </div>
    `;
  }

  private _renderSwatch(color: string, index: number) {
    const isSelected = this.value === color;
    const light = isLightColor(color);
    const checkColor = light ? '#000' : '#fff';

    return html`
      <button class="swatch"
              role="option"
              aria-selected="${isSelected}"
              aria-label="${color}"
              tabindex="${index === 0 ? '0' : '-1'}"
              @click="${() => this._selectColor(color, index)}"
              @keydown="${(e: KeyboardEvent) => this._handleKeydown(e)}">
        <div class="swatch-inner" style="background:${color}">
          <svg class="check" viewBox="0 0 14 14" fill="${checkColor}">
            <path d="M11.5 3.5L5.5 10.5L2.5 7.5" stroke="${checkColor}" stroke-width="2"
                  fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </button>
    `;
  }

  private _selectColor(color: string, index: number) {
    this.value = color;
    this.dispatchEvent(new CustomEvent('ep-color-select', {
      bubbles: true, composed: true,
      detail: { color, index },
    }));
  }

  private _handleKeydown(e: KeyboardEvent) {
    const swatches = Array.from(
      this.renderRoot.querySelectorAll<HTMLElement>('.swatch')
    );
    const current = e.currentTarget as HTMLElement;
    const idx = swatches.indexOf(current);
    let nextIdx = -1;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIdx = (idx + 1) % swatches.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIdx = (idx - 1 + swatches.length) % swatches.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = swatches.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        current.click();
        return;
      default:
        return;
    }

    e.preventDefault();
    swatches[idx].setAttribute('tabindex', '-1');
    swatches[nextIdx].setAttribute('tabindex', '0');
    swatches[nextIdx].focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-color-picker': EpColorPicker;
  }
}
