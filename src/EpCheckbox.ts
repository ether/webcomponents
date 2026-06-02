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

    /* Etherpad colibris toggle: a light, outlined track (bg-soft fill with a
       text-soft border) that switches to a primary-coloured border when
       checked. */
    .track {
      position: relative;
      box-sizing: border-box;
      background: var(--bg-soft-color, #f2f3f4);
      border: 2px solid var(--text-soft-color, #576273);
      border-radius: 10px;
      opacity: 0.7;
      transition: border-color 0.2s ease, opacity 0.2s ease;
      flex-shrink: 0;
    }
    
    :host([variant="default"]) .track {
      width: 36px;
      height: 20px;
    }
    
    :host([variant="retro"]) .track {
      width: 36px;
      height: 10px;
    }

    :host([checked]) .track {
      background: transparent;
      border-color: var(--primary-color, #64d29b);
      opacity: 1;
    }

    .thumb {
      position: absolute;
      top: 50%;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--text-soft-color, #576273);
      transition: transform 0.2s ease, background 0.2s ease;
      transform: translateY(-50%);
    }

    :host([checked]) .thumb {
      background: var(--primary-color, #64d29b);
    }
    
    :host([variant="default"]) .thumb {
      left: 2px;
    }

    :host([variant="default"][checked]) .thumb {
      transform: translate(16px, -50%);
    }

    :host([variant="retro"][checked]) .thumb {
      transform: translate(20px, -50%);
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
  @property({ reflect: true }) variant: 'default' | 'retro' = 'default';
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
