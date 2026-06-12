import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-button')
export class EpButton extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-block;
    }

    button {
      font-family: var(--ep-font);
      padding: 5px 20px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
      line-height: 1.5;
      border: none;
      outline: none;
      /* Reset the UA button background so it doesn't leak through variants
         that set their own (default/ghost/icon were showing the browser's
         light ButtonFace, which looked broken in dark themes). */
      background: transparent;
      display: inline-flex;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      justify-content: center;
      align-items: center;
      gap: 6px;
    }

    button:focus-visible {
      outline: 2px solid var(--dark-color, #576273);
      outline-offset: 2px;
    }

    /* Uppercase */
    :host([uppercase]) button {
      text-transform: uppercase;
    }

    /* Default */
    :host([variant="default"]) button,
    :host(:not([variant])) button {
      color: var(--text-color, #485365);
      border: 1px solid var(--middle-color, #d2d2d2);
    }

    :host([variant="default"]) button:hover,
    :host(:not([variant])) button:hover {
      background: var(--bg-soft-color, #f2f3f4);
    }

    /* Primary — matches Etherpad colibris .btn-primary: primary-coloured
       background with bg-coloured (white) text. */
    :host([variant="primary"]) button {
      background: var(--primary-color, #64d29b);
      color: var(--bg-color, #ffffff);
      border: none;
      transition: filter 0.15s ease, opacity 0.15s ease;
    }

    :host([variant="primary"]) button:hover {
      filter: brightness(0.94);
    }

    :host([variant="primary"]) button:active {
      filter: brightness(0.88);
    }

    /* Ghost */
    :host([variant="ghost"]) button {
      background: transparent;
      color: var(--text-color, #485365);
      border: none;
      padding: 5px 12px;
    }

    :host([variant="ghost"]) button:hover {
      background: var(--bg-soft-color, #f2f3f4);
    }

    /* Icon */
    :host([variant="icon"]) button {
      background: transparent;
      color: var(--text-color, #485365);
      border: none;
      padding: 4px;
      border-radius: 3px;
      min-width: 28px;
      min-height: 28px;
      justify-content: center;
    }

    :host([variant="icon"]) button:hover {
      background: var(--bg-soft-color, #f2f3f4);
    }

    /* Sizes */
    :host([size="small"]) button {
      padding: 3px 12px;
      font-size: 12px;
    }

    :host([size="large"]) button {
      padding: 8px 28px;
      font-size: 16px;
    }

    /* Disabled */
    :host([disabled]) button {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
  `;

  @property({ reflect: true }) variant: 'default' | 'primary' | 'ghost' | 'icon' = 'default';
  @property({ reflect: true }) size: 'small' | 'medium' | 'large' = 'medium';
  @property({ reflect: true, type: Boolean }) uppercase = false
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() type: 'button' | 'submit' | 'reset' = 'button';

  private _onClick() {
    if (this.disabled || this.type !== 'submit') return;
    const form = this.closest('form');
    if (!form) return;
    form.requestSubmit();
  }

  render() {
    return html`
      <button part="button" type="${this.type}" ?disabled="${this.disabled}" @click="${this._onClick}">
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-button': EpButton;
  }
}
