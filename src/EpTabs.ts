import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * One tab of an `<ep-tabs>` group. Its content is the panel shown while the
 * tab is selected.
 */
@customElement('ep-tab')
export class EpTab extends LitElement {
  static styles = css`
    :host { display: block; }
    :host([hidden]) { display: none; }
  `;

  /** Identifies the tab; defaults to its position. */
  @property({ reflect: true }) value = '';
  /** Text of the tab button. */
  @property() label = '';
  @property({ type: Boolean, reflect: true }) disabled = false;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'tabpanel');
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('label') || changed.has('value') || changed.has('disabled')) {
      this.dispatchEvent(new Event('ep-tab-updated', { bubbles: true }));
    }
    if (changed.has('label')) {
      if (this.label) this.setAttribute('aria-label', this.label);
      else this.removeAttribute('aria-label');
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

/**
 * Tab group. Children are `<ep-tab>` elements; the header is built from their
 * labels.
 *
 *   <ep-tabs value="general">
 *     <ep-tab value="general" label="General">…</ep-tab>
 *     <ep-tab value="users" label="Users">…</ep-tab>
 *   </ep-tabs>
 *
 * Fires `ep-tab-change` (detail: `{ value }`) when the user picks a tab.
 */
@customElement('ep-tabs')
export class EpTabs extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: block;
      font-family: var(--ep-font);
      color: var(--text-color, #485365);
    }

    [role="tablist"] {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--middle-color, #d2d2d2);
      overflow-x: auto;
      scrollbar-width: none;
    }

    :host([variant="pills"]) [role="tablist"] {
      border-bottom: none;
      background: var(--bg-soft-color, #f2f3f4);
      border-radius: var(--radius-large, 5px);
      padding: 3px;
    }

    button {
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-soft-color, #576273);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      padding: 8px 14px;
      cursor: pointer;
      white-space: nowrap;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    button:hover { color: var(--text-color, #485365); }

    button[aria-selected="true"] {
      color: var(--text-color, #485365);
      border-bottom-color: var(--primary-color, #64d29b);
    }

    :host([variant="pills"]) button {
      border-bottom: none;
      margin: 0;
      border-radius: calc(var(--radius, 4px) - 1px);
      padding: 5px 12px;
    }

    :host([variant="pills"]) button[aria-selected="true"] {
      background: var(--bg-color, #ffffff);
      box-shadow: 0 1px 2px rgba(27, 39, 51, 0.12);
    }

    button:focus-visible {
      outline: 2px solid var(--focus-color, var(--dark-color, #576273));
      outline-offset: -2px;
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .panels { padding-top: var(--ep-tabs-gap, 16px); }
  `;

  /** Value of the selected tab. Empty selects the first enabled tab. */
  @property({ reflect: true }) value = '';
  /** `underline` (default) or `pills`. */
  @property({ reflect: true }) variant: 'underline' | 'pills' = 'underline';

  @state() private _tabs: EpTab[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ep-tab-updated', this._collect);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ep-tab-updated', this._collect);
  }

  private _collect = () => {
    this._tabs = Array.from(this.children).filter(
      (c): c is EpTab => c instanceof EpTab,
    );
    this._keys = this._computeKeys();
    this._sync();
  };

  /** Unique key per tab: its value, its position if it has none. */
  private _keys: string[] = [];

  private _computeKeys(): string[] {
    const seen = new Set<string>();
    return this._tabs.map((tab, i) => {
      let key = tab.value || String(i);
      if (seen.has(key)) {
        console.warn(`ep-tabs: duplicate tab value "${key}"; only the first tab can be selected by it`);
        key = `${key}#${i}`;
        while (seen.has(key)) key += '#';
      }
      seen.add(key);
      return key;
    });
  }

  /** Index of the selected tab (falls back to the first enabled tab), or -1. */
  private get _selectedIndex(): number {
    const i = this._keys.indexOf(this.value);
    if (i >= 0 && !this._tabs[i]?.disabled) return i;
    return this._tabs.findIndex((t) => !t.disabled);
  }

  /** The value actually selected (falls back to the first enabled tab). */
  get selected(): string {
    const i = this._selectedIndex;
    return i >= 0 ? this._keys[i] : '';
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('value')) this._sync();
    this._linkPanels();
  }

  private _sync() {
    const selected = this._selectedIndex;
    this._tabs.forEach((tab, i) => {
      tab.hidden = i !== selected;
    });
  }

  /**
   * Tab buttons live in the shadow root and panels in the light DOM, so ID
   * references cannot connect them. Where the browser supports ARIA element
   * reflection, point each button at its panel; panels carry the tab label
   * as aria-label in any case.
   */
  private _linkPanels() {
    const buttons = this.renderRoot.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
    buttons.forEach((btn, i) => {
      const tab = this._tabs[i];
      if (tab && 'ariaControlsElements' in btn) {
        (btn as HTMLButtonElement & { ariaControlsElements: Element[] }).ariaControlsElements = [tab];
      }
    });
  }

  private _select(value: string, focus = false) {
    if (value !== this.value) {
      this.value = value;
      this.dispatchEvent(new CustomEvent('ep-tab-change', {
        bubbles: true, composed: true, detail: { value },
      }));
    }
    if (focus) {
      this.updateComplete.then(() => {
        this.renderRoot.querySelector<HTMLButtonElement>('button[aria-selected="true"]')?.focus();
      });
    }
  }

  private _onKeydown(e: KeyboardEvent) {
    const enabled = this._tabs
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !t.disabled);
    if (!enabled.length) return;
    // Start from the button that has focus, not from the selection: the
    // application may have changed the value meanwhile.
    const focused = (e.target as HTMLElement | null)?.closest?.('button[role="tab"]') as HTMLButtonElement | null;
    const from = focused ? Number(focused.dataset.index) : this._selectedIndex;
    const at = enabled.findIndex(({ i }) => i === from);
    let next = -1;
    switch (e.key) {
      case 'ArrowRight': next = (at + 1) % enabled.length; break;
      case 'ArrowLeft': next = (at - 1 + enabled.length) % enabled.length; break;
      case 'Home': next = 0; break;
      case 'End': next = enabled.length - 1; break;
      default: return;
    }
    e.preventDefault();
    this._select(this._keys[enabled[next].i], true);
  }

  render() {
    const selected = this._selectedIndex;
    return html`
      <div role="tablist" part="tablist" @keydown=${this._onKeydown}>
        ${this._tabs.map((tab, i) => {
          const v = this._keys[i];
          const isSel = i === selected;
          return html`<button
            role="tab"
            part="tab"
            type="button"
            aria-selected=${isSel ? 'true' : 'false'}
            tabindex=${isSel ? '0' : '-1'}
            ?disabled=${tab.disabled}
            data-value=${v}
            data-index=${i}
            @click=${() => this._select(v)}
          >${tab.label || v}</button>`;
        })}
      </div>
      <div class="panels" part="panels">
        <slot @slotchange=${this._collect}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-tabs': EpTabs;
    'ep-tab': EpTab;
  }
}
