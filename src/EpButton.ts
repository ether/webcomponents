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
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
      line-height: 1.5;
      border: none;
      outline: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    button:focus-visible {
      outline: 2px solid var(--dark-color, #576273);
      outline-offset: 2px;
    }

    /* Default */
    :host([variant="default"]) button,
    button {
      background: transparent;
      color: var(--text-color, #485365);
      border: 1px solid var(--middle-color, #d2d2d2);
    }

    :host([variant="default"]) button:hover,
    button:hover {
      background: var(--bg-soft-color, #f2f3f4);
    }

    /* Primary */
    :host([variant="primary"]) button {
      background: var(--text-color, #485365);
      color: white;
      border: 1px solid var(--text-color, #485365);
    }

    :host([variant="primary"]) button:hover {
      background: var(--dark-color, #576273);
      border-color: var(--dark-color, #576273);
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
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() type: 'button' | 'submit' | 'reset' = 'button';

  render() {
    return html`
      <button type="${this.type}" ?disabled="${this.disabled}">
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
