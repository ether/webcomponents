import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), ep-checkbox, ep-select, ep-dropdown, ep-button, ep-segmented';

/**
 * Non-modal panel that drops down from a toolbar button (settings, share,
 * import/export, users …). The page stays usable behind it.
 *
 * Positioned below `anchor` (an element or its id) and right-aligned to it,
 * or fixed top-right without an anchor. On narrow screens it becomes a
 * full-width sheet. Escape and a click outside close it (unless
 * `persistent`); focus moves into it on open and back to the anchor on
 * close.
 *
 * Events: `ep-popup-open`, `ep-popup-close` (detail `{ reason }`:
 * `escape` | `outside` | `button` | `api`).
 */
@customElement('ep-popup')
export class EpPopup extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      z-index: var(--ep-popup-z-index, 1000);
      display: none;
      top: var(--ep-popup-top, 56px);
      right: var(--ep-popup-right, 12px);
      width: var(--ep-popup-width, 360px);
      max-width: calc(100vw - 24px);
      max-height: calc(100vh - var(--ep-popup-top, 56px) - 12px);
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      font-size: 14px;
      color: var(--text-color, #485365);
    }
    :host([open]) { display: flex; }
    .panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: inherit;
      background: var(--bg-color, #ffffff);
      border-radius: var(--radius-large, 5px);
      box-shadow: var(--shadow, 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08));
      overflow: hidden;
      animation: ep-popup-in 0.12s ease-out;
    }
    @keyframes ep-popup-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
    }
    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 12px 10px 18px;
    }
    h2 {
      flex: 1;
      margin: 0;
      font-size: 16px;
      font-weight: 700;
    }
    .close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: var(--radius, 4px);
      background: transparent;
      color: var(--text-soft-color, #576273);
      cursor: pointer;
    }
    .close:hover { background: var(--bg-soft-color, #f2f3f4); color: var(--text-color, #485365); }
    .close:focus-visible {
      outline: 2px solid var(--focus-color, var(--dark-color, #576273));
      outline-offset: 1px;
    }
    .body {
      padding: 0 18px 16px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    :host(:not([heading])) .body { padding-top: 16px; }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 18px;
      border-top: 1px solid var(--middle-color, #d2d2d2);
    }
    footer[hidden] { display: none; }

    @media (max-width: 600px) {
      :host {
        left: 0 !important;
        right: 0 !important;
        width: 100%;
        max-width: 100%;
        top: auto !important;
        bottom: 0;
        max-height: 85vh;
      }
      .panel {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ reflect: true }) heading = '';
  /** Element or element id the popup hangs below. */
  @property() anchor: string | HTMLElement = '';
  /** `end` (default) aligns the right edges, `start` the left edges. */
  @property() align: 'start' | 'end' = 'end';
  /** Escape and clicks outside do not close it. */
  @property({ type: Boolean }) persistent = false;
  @property({ attribute: 'close-label' }) closeLabel = 'Close';
  @property({ type: Boolean, attribute: 'hide-close' }) hideClose = false;

  @query('.panel') private _panel!: HTMLElement;

  private _returnFocus: HTMLElement | null = null;
  private _hasFooter = false;

  show() { this.open = true; }
  hide() { this._close('api'); }
  toggle() { if (this.open) this.hide(); else this.show(); }

  connectedCallback() {
    super.connectedCallback();
    if (this.open) this._listen(true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._listen(false);
  }

  private _listen(on: boolean) {
    if (on) {
      document.addEventListener('pointerdown', this._onOutside, true);
      document.addEventListener('keydown', this._onKeydown);
      window.addEventListener('resize', this._position);
      window.addEventListener('scroll', this._position, true);
    } else {
      document.removeEventListener('pointerdown', this._onOutside, true);
      document.removeEventListener('keydown', this._onKeydown);
      window.removeEventListener('resize', this._position);
      window.removeEventListener('scroll', this._position, true);
    }
  }

  private _anchorEl(): HTMLElement | null {
    if (!this.anchor) return null;
    if (typeof this.anchor !== 'string') return this.anchor;
    const root = this.getRootNode() as Document | ShadowRoot;
    return (root.getElementById?.(this.anchor) ?? document.getElementById(this.anchor)) as HTMLElement | null;
  }

  private _position = () => {
    const a = this._anchorEl();
    if (!a || !this.open) return;
    const r = a.getBoundingClientRect();
    this.style.top = `${Math.round(r.bottom + 6)}px`;
    this.style.setProperty('--ep-popup-top', `${Math.round(r.bottom + 6)}px`);
    if (this.align === 'start') {
      this.style.left = `${Math.max(12, Math.round(r.left))}px`;
      this.style.right = 'auto';
    } else {
      this.style.right = `${Math.max(12, Math.round(document.documentElement.clientWidth - r.right))}px`;
      this.style.left = 'auto';
    }
  };

  private _onOutside = (e: PointerEvent) => {
    if (this.persistent || !this.open) return;
    const path = e.composedPath();
    if (path.includes(this)) return;
    const a = this._anchorEl();
    // The anchor usually toggles the popup itself.
    if (a && path.includes(a)) return;
    this._close('outside');
  };

  private _onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || this.persistent || !this.open) return;
    e.stopPropagation();
    this._close('escape');
  };

  private _close(reason: 'escape' | 'outside' | 'button' | 'api') {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('ep-popup-close', {
      bubbles: true, composed: true, detail: { reason },
    }));
    // Only return focus if it was inside the popup (an outside click moves it elsewhere).
    if (reason !== 'outside') {
      const target = this._returnFocus ?? this._anchorEl();
      target?.focus?.();
    }
    this._returnFocus = null;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('open')) {
      const was = changed.get('open');
      if (this.open) {
        this._returnFocus = (document.activeElement as HTMLElement | null) ?? null;
        this._listen(true);
        this._position();
        this.dispatchEvent(new CustomEvent('ep-popup-open', { bubbles: true, composed: true }));
        requestAnimationFrame(() => this._focusFirst());
      } else if (was) {
        this._listen(false);
      }
    }
    if (changed.has('anchor') || changed.has('align')) this._position();
  }

  private _focusFirst() {
    if (!this.open) return;
    for (const el of Array.from(this.querySelectorAll<HTMLElement>(FOCUSABLE))) {
      if ((el as HTMLButtonElement).disabled || el.closest('[hidden]')) continue;
      el.focus();
      if (this._focusInside()) return;
    }
    this._panel?.focus();
  }

  private _focusInside(): boolean {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    const host = document.activeElement;
    return !!host && (host === this || this.contains(host) || a === this._panel);
  }

  private _onFooterSlot(e: Event) {
    this._hasFooter = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="panel" part="panel" role="dialog" aria-modal="false"
           aria-labelledby=${this.heading ? 'title' : nothing} tabindex="-1">
        ${this.heading || !this.hideClose ? html`
          <header part="header">
            <h2 id="title" part="heading">${this.heading}</h2>
            ${this.hideClose ? nothing : html`
              <button class="close" part="close-button" type="button"
                      title=${this.closeLabel} aria-label=${this.closeLabel}
                      @click=${() => this._close('button')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
              </button>`}
          </header>` : nothing}
        <div class="body" part="body"><slot></slot></div>
        <footer part="footer" ?hidden=${!this._hasFooter}><slot name="footer" @slotchange=${this._onFooterSlot}></slot></footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-popup': EpPopup;
  }
}
