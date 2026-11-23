import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Button for `<ep-toolbar>`. Put an icon (SVG, icon font element, …) inside;
 * `label` becomes tooltip and accessible name.
 *
 * Fires a normal `click`, and `ep-toolbar-action` (detail: `{ key }`) when
 * it has a `key`.
 */
@customElement('ep-toolbar-button')
export class EpToolbarButton extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
    }
    :host([hidden]) { display: none; }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: var(--ep-toolbar-button-size, 32px);
      height: var(--ep-toolbar-button-size, 32px);
      padding: 0 6px;
      box-sizing: border-box;
      border: none;
      border-radius: var(--radius, 4px);
      background: transparent;
      color: var(--toolbar-text-color, var(--text-color, #485365));
      font: inherit;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    button:hover {
      background: var(--toolbar-hover-color, var(--bg-soft-color, #f2f3f4));
    }
    :host([pressed]) button,
    :host([active]) button {
      background: var(--toolbar-active-color, var(--bg-soft-color, #f2f3f4));
      color: var(--toolbar-active-text-color, var(--primary-color, #64d29b));
    }
    button:focus-visible {
      outline: 2px solid var(--focus-color, var(--dark-color, #576273));
      outline-offset: 1px;
    }
    :host([disabled]) button {
      opacity: 0.4;
      cursor: not-allowed;
    }
    ::slotted(svg), ::slotted(.icon) {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .text { white-space: nowrap; }
    .badge {
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      box-sizing: border-box;
      border-radius: 8px;
      background: var(--primary-color, #64d29b);
      color: var(--primary-text-color, #ffffff);
      font-size: 11px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
    }
  `;

  /** Tooltip and accessible name. */
  @property() label = '';
  /** Identifier reported by `ep-toolbar-action`. */
  @property({ reflect: true }) key = '';
  /** Makes the button a toggle; reflects `pressed` as aria-pressed. */
  @property({ type: Boolean, reflect: true }) toggle = false;
  @property({ type: Boolean, reflect: true }) pressed = false;
  /** Highlights the button without toggle semantics (e.g. open popup). */
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Shows the label next to the icon. */
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = false;
  /**
   * For buttons that open something: `true` / `false` becomes aria-expanded,
   * empty leaves it out.
   */
  @property({ reflect: true }) expanded: '' | 'true' | 'false' = '';
  /** Small counter (e.g. users online). Empty hides it. */
  @property() badge = '';
  /** `low` items move into the overflow row on narrow toolbars. */
  @property({ reflect: true }) priority: 'normal' | 'low' = 'normal';

  /** @internal roving tabindex managed by the toolbar. */
  @property({ attribute: false }) rovingTabIndex = 0;

  focus(options?: FocusOptions) {
    this.renderRoot.querySelector('button')?.focus(options);
  }

  private _onClick(e: MouseEvent) {
    if (this.disabled) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    if (this.toggle) this.pressed = !this.pressed;
    if (this.key) {
      this.dispatchEvent(new CustomEvent('ep-toolbar-action', {
        bubbles: true, composed: true,
        detail: { key: this.key, pressed: this.toggle ? this.pressed : undefined },
      }));
    }
  }

  render() {
    const badge = this.badge !== '' && this.badge !== undefined && this.badge !== null;
    return html`
      <button
        part="button"
        type="button"
        title=${this.label || nothing}
        aria-label=${this.label || nothing}
        aria-pressed=${this.toggle ? String(this.pressed) : nothing}
        aria-expanded=${this.expanded || nothing}
        aria-disabled=${this.disabled ? 'true' : nothing}
        tabindex=${this.rovingTabIndex}
        @click=${this._onClick}
      >
        <slot></slot>
        ${this.showLabel && this.label ? html`<span class="text">${this.label}</span>` : nothing}
        ${badge ? html`<span class="badge" part="badge" aria-hidden="true">${this.badge}</span>` : nothing}
      </button>
    `;
  }
}

/** Vertical divider between toolbar groups. */
@customElement('ep-toolbar-separator')
export class EpToolbarSeparator extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      width: 1px;
      height: 20px;
      margin: 0 6px;
      background: var(--toolbar-border-color, var(--middle-color, #d2d2d2));
      align-self: center;
      flex-shrink: 0;
    }
    :host([hidden]) { display: none; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'separator');
    this.setAttribute('aria-orientation', 'vertical');
  }
}

/**
 * Editor toolbar. Default slot: left side (formatting), slot `end`: right
 * side (actions). Arrow keys, Home and End move between the buttons; only
 * one button is in the tab order.
 *
 * Below `breakpoint` pixels the toolbar becomes `compact`: buttons with
 * `priority="low"` move into a second row that a "more" button opens.
 */
@customElement('ep-toolbar')
export class EpToolbar extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--toolbar-bg-color, var(--bg-color, #ffffff));
      color: var(--toolbar-text-color, var(--text-color, #485365));
      border-bottom: 1px solid var(--toolbar-border-color, var(--middle-color, #d2d2d2));
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: var(--ep-toolbar-padding, 6px 10px);
      min-height: 32px;
    }
    .start, .end {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }
    .start { flex: 1; flex-wrap: wrap; }
    .end { flex-shrink: 0; }
    .more { display: none; }
    :host([compact]) .more { display: inline-flex; }
    .overflow {
      display: none;
      flex-wrap: wrap;
      gap: 2px;
      padding: 4px 10px 6px;
      border-top: 1px solid var(--toolbar-border-color, var(--middle-color, #d2d2d2));
    }
    :host([compact][expanded]) .overflow { display: flex; }
  `;

  /** Accessible name of the toolbar. */
  @property() label = '';
  /** Width in px below which the toolbar turns compact. 0 disables it. */
  @property({ type: Number }) breakpoint = 800;
  /** Label of the "more" button. */
  @property({ attribute: 'more-label' }) moreLabel = 'More';
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) expanded = false;

  @state() private _focusIndex = 0;

  private _resize?: ResizeObserver;
  private _mutation?: MutationObserver;

  connectedCallback() {
    super.connectedCallback();
    if (typeof ResizeObserver === 'function') {
      this._resize = new ResizeObserver(() => this._measure());
      this._resize.observe(this);
    }
    this._mutation = new MutationObserver(() => this._placeItems());
    this._mutation.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['priority', 'disabled', 'hidden'] });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._resize?.disconnect();
    this._mutation?.disconnect();
  }

  firstUpdated() {
    this._measure();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('compact')) {
      if (!this.compact) this.expanded = false;
      this._placeItems();
    }
    if (changed.has('breakpoint')) this._measure();
  }

  private _measure() {
    const width = this.getBoundingClientRect().width;
    this.compact = this.breakpoint > 0 && width > 0 && width < this.breakpoint;
  }

  /** In compact mode low-priority buttons go to the overflow slot. */
  private _placeItems() {
    // Current low-priority items plus those moved earlier (their priority may have changed).
    for (const el of Array.from(this.children) as HTMLElement[]) {
      const eligible = this.compact && el.getAttribute('priority') === 'low';
      if (eligible) {
        if (el.dataset.homeSlot === undefined) el.dataset.homeSlot = el.getAttribute('slot') ?? '';
        if (el.getAttribute('slot') !== 'overflow') el.setAttribute('slot', 'overflow');
      } else if (el.dataset.homeSlot !== undefined) {
        const home = el.dataset.homeSlot;
        delete el.dataset.homeSlot;
        if (home) el.setAttribute('slot', home);
        else el.removeAttribute('slot');
      }
    }
    this._updateRoving();
  }

  private get _more(): EpToolbarButton | null {
    return this.renderRoot?.querySelector<EpToolbarButton>('.more') ?? null;
  }

  /**
   * Buttons in visual order, without hidden or collapsed ones. In compact
   * mode the "more" button follows the `end` items.
   */
  get items(): EpToolbarButton[] {
    const slots = ['', 'end', 'overflow'];
    const all = Array.from(this.querySelectorAll<EpToolbarButton>('ep-toolbar-button'));
    const bySlot = (b: EpToolbarButton) => {
      const top = Array.from(this.children).find((c) => c === b || c.contains(b));
      return slots.indexOf(top?.getAttribute('slot') ?? '');
    };
    const visible = all
      .filter((b) => !b.hidden && !b.closest('[hidden]'))
      .filter((b) => !(bySlot(b) === 2 && !(this.compact && this.expanded)))
      .sort((a, b) => bySlot(a) - bySlot(b));
    const more = this._more;
    if (!this.compact || !more) return visible;
    const firstOverflow = visible.findIndex((b) => bySlot(b) === 2);
    if (firstOverflow < 0) return [...visible, more];
    return [...visible.slice(0, firstOverflow), more, ...visible.slice(firstOverflow)];
  }

  private _updateRoving() {
    const items = this.items;
    if (this._focusIndex >= items.length) this._focusIndex = Math.max(0, items.length - 1);
    const more = this._more;
    for (const b of [...Array.from(this.querySelectorAll<EpToolbarButton>('ep-toolbar-button')), ...(more ? [more] : [])]) {
      b.rovingTabIndex = -1;
    }
    if (items[this._focusIndex]) items[this._focusIndex].rovingTabIndex = 0;
  }

  private _onFocusIn(e: FocusEvent) {
    const btn = e.composedPath().find((n) => n instanceof EpToolbarButton) as EpToolbarButton | undefined;
    if (!btn) return;
    const i = this.items.indexOf(btn);
    if (i >= 0 && i !== this._focusIndex) {
      this._focusIndex = i;
      this._updateRoving();
    }
  }

  private _onKeydown(e: KeyboardEvent) {
    const items = this.items;
    if (!items.length) return;
    let next: number;
    switch (e.key) {
      case 'ArrowRight': next = (this._focusIndex + 1) % items.length; break;
      case 'ArrowLeft': next = (this._focusIndex - 1 + items.length) % items.length; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default: return;
    }
    e.preventDefault();
    this._focusIndex = next;
    this._updateRoving();
    items[next].focus();
  }

  private _toggleMore() {
    this.expanded = !this.expanded;
    this.updateComplete.then(() => this._updateRoving());
  }

  render() {
    return html`
      <div class="row" part="row" role="toolbar" aria-label=${this.label || nothing}
           @keydown=${this._onKeydown} @focusin=${this._onFocusIn}>
        <div class="start" part="start"><slot @slotchange=${this._placeItems}></slot></div>
        <div class="end" part="end">
          <slot name="end" @slotchange=${this._placeItems}></slot>
          <ep-toolbar-button class="more" part="more" label=${this.moreLabel}
                             ?active=${this.expanded}
                             expanded=${String(this.expanded)}
                             @click=${this._toggleMore}>
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>
          </ep-toolbar-button>
        </div>
      </div>
      <div class="overflow" part="overflow" role="toolbar" aria-label=${this.moreLabel}
           @keydown=${this._onKeydown} @focusin=${this._onFocusIn}>
        <slot name="overflow" @slotchange=${this._updateRoving}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-toolbar': EpToolbar;
    'ep-toolbar-button': EpToolbarButton;
    'ep-toolbar-separator': EpToolbarSeparator;
  }
}
