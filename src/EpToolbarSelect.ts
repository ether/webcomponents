import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './EpDropdown.js';
import './EpDropdownItem.js';

interface ToolbarSelectOption {
  label: string;
  value: string;
}

@customElement('ep-toolbar-select')
export class EpToolbarSelect extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    ep-dropdown {
      display: flex;
      align-items: center;
    }

    .trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      white-space: nowrap;
      font: inherit;
    }

    .trigger:hover {
      background-color: var(--bg-soft-color, #f2f3f4);
      color: var(--text-color, #485365);
    }

    .trigger:focus-visible {
      outline: 2px solid var(--dark-color, #576273);
      outline-offset: 1px;
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .text {
      display: inline-block;
      min-width: 0;
      max-width: 96px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      font-weight: 500;
    }

    .caret {
      flex: 0 0 auto;
      display: inline-block;
      width: 8px;
      height: 8px;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transform: translateY(-1px) rotate(45deg);
      opacity: 0.7;
    }
  `;

  @property({ type: Array }) options: ToolbarSelectOption[] = [];
  @property() value = '';
  @property({ attribute: 'icon-class' }) iconClass = '';
  @property() label = '';
  @property() placeholder = '';

  render() {
    const selected = this.options.find(o => o.value === this.value);
    const visibleLabel = selected?.label ?? this.placeholder ?? this.label ?? '';
    const title = this.label && selected
      ? `${this.label}: ${selected.label}`
      : (this.label || visibleLabel);

    return html`
      <ep-dropdown align="left" trigger="click"
                   @ep-dropdown-select="${this._onSelect}">
        <button slot="trigger" type="button" class="trigger"
                title="${title}" aria-label="${title}">
          ${this.iconClass
            ? html`<span class="icon buttonicon ${this.iconClass}"></span>`
            : ''}
          <span class="text">${visibleLabel}</span>
          <span class="caret" aria-hidden="true"></span>
        </button>
        <div slot="content">
          ${this.options.map(opt => html`
            <ep-dropdown-item value="${opt.value}">${opt.label}</ep-dropdown-item>
          `)}
        </div>
      </ep-dropdown>
    `;
  }

  private _onSelect(e: CustomEvent) {
    this.value = String(e.detail?.value ?? '');
    this.dispatchEvent(new CustomEvent('ep-toolbar-select:change', {
      bubbles: true, composed: true,
      detail: { value: this.value },
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-toolbar-select': EpToolbarSelect;
  }
}
