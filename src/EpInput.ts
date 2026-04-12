import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-input')
export class EpInput extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      --ep-input-focus-border-color: var(--text-soft-color, #8a94a3);
      display: block;
      box-sizing: border-box;
    }

    label {
      display: block;
      font-family: var(--ep-font);
      font-size: 14px;
      font-weight: 700;
      color: var(--text-color, #485365);
      margin-bottom: 6px;
    }

    input, textarea {
      font-family: var(--ep-font);
      width: 100%;
      height: 100%;
      min-height: 0;
      box-sizing: border-box;
      display: block;
      margin: 0;
      padding: 8px 10px;
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: 3px;
      font-size: 14px;
      background: var(--bg-soft-color, #f2f3f4);
      color: var(--text-color, #485365);
      outline: none;
      transition: border-color 0.15s ease;
    }

    input::placeholder, textarea::placeholder {
      color: var(--text-soft-color, #576273);
    }

    input:focus, textarea:focus {
      border-color: var(--ep-input-focus-border-color);
    }

    textarea {
      resize: vertical;
    }

    :host([disabled]) input,
    :host([disabled]) textarea {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .hint {
      font-family: var(--ep-font);
      font-size: 12px;
      color: var(--text-soft-color, #576273);
      margin-top: 4px;
    }

    :host([error]) input,
    :host([error]) textarea {
      border-color: #d9534f;
    }

    .error-text {
      font-family: var(--ep-font);
      font-size: 12px;
      color: #d9534f;
      margin-top: 4px;
    }
  `;

  @property() label = '';
  @property() value = '';
  @property() placeholder = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) error = false;
  @property({ reflect: true }) type: 'text' | 'password' | 'email' | 'number' | 'textarea' = 'text';

  render() {
    return html`
      ${this.label ? html`<label>${this.label}</label>` : ''}
      ${this.type === 'textarea'
        ? html`<textarea
            .value="${this.value}"
            placeholder="${this.placeholder}"
            ?disabled="${this.disabled}"
            @input="${this._onInput}"
          ></textarea>`
        : html`<input
            type="${this.type}"
            .value="${this.value}"
            placeholder="${this.placeholder}"
            ?disabled="${this.disabled}"
            @input="${this._onInput}"
          />`
      }
      ${this.error && this.errorText
        ? html`<div class="error-text">${this.errorText}</div>`
        : this.hint
          ? html`<div class="hint">${this.hint}</div>`
          : ''
      }
    `;
  }

  private _onInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('ep-input', {
      bubbles: true, composed: true,
      detail: { value: this.value },
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-input': EpInput;
  }
}
