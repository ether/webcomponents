import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-checkbox')
export class EpCheckbox extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-family: var(--ep-font);
      font-size: 14px;
      color: var(--text-color, #485365);
      user-select: none;
    }

    :host([disabled]) {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    .track {
      position: relative;
      width: 36px;
      height: 20px;
      background: var(--middle-color, #d2d2d2);
      border-radius: 10px;
      transition: background 0.2s ease;
      flex-shrink: 0;
    }

    :host([checked]) .track {
      background: var(--text-color, #485365);
    }

    .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease;
    }

    :host([checked]) .thumb {
      transform: translateX(16px);
    }

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    :host(:focus-within) .track {
      outline: 2px solid var(--dark-color, #576273);
      outline-offset: 2px;
    }

    .label {
      line-height: 1.4;
    }
  `;

  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';

  render() {
    return html`
      <div class="track" @click="${this._toggle}">
        <div class="thumb"></div>
      </div>
      <input type="checkbox"
             .checked="${this.checked}"
             ?disabled="${this.disabled}"
             @change="${this._toggle}"
             aria-label="${this.label}" />
      ${this.label ? html`<span class="label" @click="${this._toggle}">${this.label}</span>` : ''}
    `;
  }

  private _toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('ep-change', {
      bubbles: true, composed: true,
      detail: { checked: this.checked },
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-checkbox': EpCheckbox;
  }
}
