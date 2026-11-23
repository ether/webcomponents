import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

export interface EpSegmentedOption {
  value: string;
  label: string;
  /**
   * Optional inline SVG markup shown before the label. It is inserted as is,
   * so only pass trusted, static markup.
   */
  icon?: string;
  disabled?: boolean;
}

/**
 * A row of mutually exclusive options (e.g. light / dark / system). Behaves
 * like a radio group: arrow keys change the selection.
 *
 * Fires `ep-change` (detail `{ value }`).
 */
@customElement('ep-segmented')
export class EpSegmented extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      font-size: 13px;
    }
    :host([disabled]) { opacity: 0.5; pointer-events: none; }
    [role="radiogroup"] {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      background: var(--bg-soft-color, #f2f3f4);
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: var(--radius, 4px);
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: none;
      border-radius: calc(var(--radius, 4px) - 1px);
      background: transparent;
      color: var(--text-soft-color, #576273);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover { color: var(--text-color, #485365); }
    button[aria-checked="true"] {
      background: var(--bg-color, #ffffff);
      color: var(--text-color, #485365);
      box-shadow: 0 1px 2px rgba(27, 39, 51, 0.12);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button:focus-visible {
      outline: 2px solid var(--focus-color, var(--dark-color, #576273));
      outline-offset: 1px;
    }
    svg { width: 16px; height: 16px; flex-shrink: 0; }
  `;

  @property({ attribute: false }) options: EpSegmentedOption[] = [];
  @property({ reflect: true }) value = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Accessible name of the group. */
  @property() label = '';

  private _choose(value: string, focus = false) {
    if (this.disabled) return;
    if (value !== this.value) {
      this.value = value;
      this.dispatchEvent(new CustomEvent('ep-change', {
        bubbles: true, composed: true, detail: { value },
      }));
    }
    if (focus) {
      this.updateComplete.then(() =>
        this.renderRoot.querySelector<HTMLButtonElement>('button[aria-checked="true"]')?.focus());
    }
  }

  focus(options?: FocusOptions) {
    const btn = this.renderRoot.querySelector<HTMLButtonElement>('button[tabindex="0"]');
    btn?.focus(options);
  }

  private _onKeydown(e: KeyboardEvent) {
    if (this.disabled) return;
    const enabled = this.options.filter((o) => !o.disabled);
    if (!enabled.length) return;
    const at = enabled.findIndex((o) => o.value === this.value);
    let next: number;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': next = at < 0 ? 0 : (at + 1) % enabled.length; break;
      case 'ArrowLeft': case 'ArrowUp': next = at < 0 ? enabled.length - 1 : (at - 1 + enabled.length) % enabled.length; break;
      case 'Home': next = 0; break;
      case 'End': next = enabled.length - 1; break;
      default: return;
    }
    e.preventDefault();
    this._choose(enabled[next].value, true);
  }

  render() {
    const hasSelection = this.options.some((o) => o.value === this.value && !o.disabled);
    const firstEnabled = this.options.find((o) => !o.disabled)?.value;
    return html`
      <div role="radiogroup" part="group" aria-label=${this.label || nothing}
           aria-disabled=${this.disabled ? 'true' : nothing} @keydown=${this._onKeydown}>
        ${this.options.map((o) => {
          const checked = o.value === this.value;
          const tabbable = hasSelection ? checked : o.value === firstEnabled;
          return html`<button type="button" role="radio" part="option"
              aria-checked=${String(checked)}
              tabindex=${tabbable ? '0' : '-1'}
              ?disabled=${this.disabled || !!o.disabled}
              @click=${() => this._choose(o.value)}>
              ${o.icon ? unsafeSVG(o.icon) : nothing}<span>${o.label}</span>
            </button>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-segmented': EpSegmented;
  }
}
