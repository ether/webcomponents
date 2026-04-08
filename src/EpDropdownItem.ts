import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-dropdown-item')
export class EpDropdownItem extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: block;
      font-family: var(--ep-font);
      font-size: 14px;
    }

    .item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      color: var(--text-color, #485365);
      cursor: pointer;
      font: inherit;
      text-align: left;
      white-space: nowrap;
      transition: background 0.1s ease;
      outline: none;
      box-sizing: border-box;
    }

    .item:hover,
    .item[aria-selected="true"],
    :host([focused]) .item {
      background: var(--bg-soft-color, #f2f3f4);
    }

    .item:focus-visible {
      background: var(--bg-soft-color, #f2f3f4);
      outline: 2px solid var(--dark-color, #576273);
      outline-offset: -2px;
    }

    :host([disabled]) .item {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;

  @property() value = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) focused = false;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'option');
  }

  setFocused(val: boolean) {
    this.focused = val;
  }

  render() {
    return html`
      <div class="item"
           role="presentation"
           aria-disabled="${this.disabled}">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-dropdown-item': EpDropdownItem;
  }
}
