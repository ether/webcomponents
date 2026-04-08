import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { EpDropdownItem } from './EpDropdownItem.js';

type TriggerMode = 'click' | 'hover';

@customElement('ep-dropdown')
export class EpDropdown extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-block;
      position: relative;
      font-family: var(--ep-font);
      font-size: 14px;
    }

    .trigger-wrapper { display: inline-flex; }

    .content-wrapper {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      min-width: 140px;
      max-height: 280px;
      overflow-y: auto;
      background: var(--bg-color, white);
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: 5px;
      box-shadow: 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08);
      z-index: 9999;
      padding: 4px 0;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }

    :host([open]) .content-wrapper { display: block; }
    :host([open]) .content-wrapper.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  @property({ reflect: true }) trigger: TriggerMode = 'click';
  @property({ reflect: true }) align: 'left' | 'right' = 'left';
  @property({ type: Boolean, reflect: true }) open = false;

  @query('.content-wrapper') private _content!: HTMLElement;

  @state() private _focusIndex = -1;
  private _hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;

  private _onDocClick = (e: Event) => {
    if (!this.open) return;
    if (!e.composedPath().includes(this)) this.close();
  };

  private _onDocKeydown = (e: KeyboardEvent) => {
    if (!this.open) return;
    this._handleKeydown(e);
  };

  private _onViewportChange = () => this._positionContent();

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', (e: Event) => {
      const target = e.target;
      if ((target as HTMLElement)?.tagName === 'EP-DROPDOWN-ITEM') {
        const item = target as EpDropdownItem;
        if (!item.disabled) this._selectItem(item);
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._removeGlobalListeners();
    if (this._hoverCloseTimer != null) clearTimeout(this._hoverCloseTimer);
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('open')) {
      if (this.open) this._onOpened();
      else this._onClosed();
    }
  }

  toggle() { this.open = !this.open; }
  close() { this.open = false; }

  render() {
    return html`
      <div class="trigger-wrapper" part="trigger"
           @mousedown="${this._preventFocusSteal}"
           @click="${this._onTriggerClick}"
           @mouseenter="${this._onMouseEnter}"
           @mouseleave="${this._onMouseLeave}">
        <slot name="trigger"></slot>
      </div>
      <div class="content-wrapper" role="listbox" part="content"
           @mousedown="${this._preventFocusSteal}">
        <slot name="content"></slot>
      </div>
    `;
  }

  private _preventFocusSteal(e: MouseEvent) { e.preventDefault(); }

  private _onTriggerClick(e: Event) {
    e.stopPropagation();
    this.toggle();
  }

  private _onMouseEnter() {
    if (this.trigger !== 'hover') return;
    if (this._hoverCloseTimer != null) {
      clearTimeout(this._hoverCloseTimer);
      this._hoverCloseTimer = null;
    }
    this.open = true;
  }

  private _onMouseLeave() {
    if (this.trigger !== 'hover') return;
    this._hoverCloseTimer = setTimeout(() => this.close(), 200);
  }

  private _onOpened() {
    this._focusIndex = -1;
    this._clearItemFocus();
    requestAnimationFrame(() => {
      this._positionContent();
      this._content?.classList.add('visible');
    });
    document.addEventListener('click', this._onDocClick, true);
    document.addEventListener('keydown', this._onDocKeydown);
    window.addEventListener('resize', this._onViewportChange);
    window.addEventListener('scroll', this._onViewportChange, true);
  }

  private _onClosed() {
    this._content?.classList.remove('visible');
    this._focusIndex = -1;
    this._clearItemFocus();
    this._removeGlobalListeners();
  }

  private _removeGlobalListeners() {
    document.removeEventListener('click', this._onDocClick, true);
    document.removeEventListener('keydown', this._onDocKeydown);
    window.removeEventListener('resize', this._onViewportChange);
    window.removeEventListener('scroll', this._onViewportChange, true);
  }

  private _positionContent() {
    const content = this._content;
    if (!content || !this.open) return;

    const hostRect = this.getBoundingClientRect();
    const pad = 8;
    const gap = 4;

    content.style.minWidth = `${Math.max(140, Math.ceil(hostRect.width))}px`;
    content.style.maxWidth = `${Math.max(140, window.innerWidth - pad * 2)}px`;

    const contentRect = content.getBoundingClientRect();
    const width = Math.max(contentRect.width, Math.ceil(hostRect.width), 140);
    const height = contentRect.height;

    let left = this.align === 'right' ? hostRect.right - width : hostRect.left;
    left = Math.min(Math.max(pad, left), Math.max(pad, window.innerWidth - width - pad));

    let top = hostRect.bottom + gap;
    if (top + height > window.innerHeight - pad) {
      top = Math.max(pad, hostRect.top - height - gap);
    }

    content.style.left = `${Math.round(left)}px`;
    content.style.top = `${Math.round(top)}px`;
  }

  private _getItems(): EpDropdownItem[] {
    return Array.from(this.querySelectorAll<EpDropdownItem>('ep-dropdown-item'));
  }

  private _handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        this.querySelector<HTMLElement>('[slot="trigger"]')?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._moveFocus(-1);
        break;
      case 'Home':
        e.preventDefault();
        this._setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        this._setFocusIndex(this._getItems().length - 1);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const items = this._getItems();
        if (this._focusIndex >= 0 && this._focusIndex < items.length) {
          const item = items[this._focusIndex];
          if (!item.disabled) this._selectItem(item);
        }
        break;
      }
    }
  }

  private _moveFocus(dir: number) {
    const items = this._getItems();
    if (!items.length) return;
    let next = this._focusIndex + dir;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    const start = next;
    while (items[next].disabled) {
      next += dir;
      if (next < 0) next = items.length - 1;
      if (next >= items.length) next = 0;
      if (next === start) return;
    }
    this._setFocusIndex(next);
  }

  private _setFocusIndex(index: number) {
    this._clearItemFocus();
    this._focusIndex = index;
    const items = this._getItems();
    if (index >= 0 && index < items.length) {
      items[index].setFocused(true);
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  private _clearItemFocus() {
    for (const item of this._getItems()) item.setFocused(false);
  }

  private _selectItem(item: EpDropdownItem) {
    this.dispatchEvent(new CustomEvent('ep-dropdown-select', {
      bubbles: true, composed: true,
      detail: { value: item.value },
    }));
    this.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-dropdown': EpDropdown;
  }
}
