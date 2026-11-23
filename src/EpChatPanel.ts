import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './EpChatMessage.js';

export interface EpChatEntry {
  id?: string;
  author: string;
  authorColor?: string;
  time?: string;
  text: string;
  own?: boolean;
}

/**
 * Chat box: header, scrolling message list and input.
 *
 * Messages come either from the `messages` property or as
 * `<ep-chat-message>` children (slot `messages`), whatever suits the app.
 * The list stays at the bottom when new messages arrive, unless the user
 * scrolled up.
 *
 * Events: `ep-chat-send` (detail `{ text }`), `ep-chat-close`,
 * `ep-chat-sticky` (detail `{ sticky }`), `ep-chat-load-more` (scrolled to
 * the top while `has-more` is set).
 */
@customElement('ep-chat-panel')
export class EpChatPanel extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      box-sizing: border-box;
      background: var(--bg-color, #ffffff);
      color: var(--text-color, #485365);
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      font-size: 14px;
    }
    :host([floating]) {
      border-radius: var(--radius-large, 5px);
      box-shadow: var(--shadow, 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08));
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 10px 8px 14px;
      border-bottom: 1px solid var(--middle-color, #d2d2d2);
      flex-shrink: 0;
    }
    h2 {
      flex: 1;
      margin: 0;
      font-size: 14px;
      font-weight: 700;
    }
    .icon-btn {
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
    .icon-btn:hover { background: var(--bg-soft-color, #f2f3f4); color: var(--text-color, #485365); }
    .icon-btn[aria-pressed="true"] { color: var(--primary-color, #64d29b); }
    .icon-btn:focus-visible, textarea:focus-visible, .send:focus-visible {
      outline: 2px solid var(--focus-color, var(--dark-color, #576273));
      outline-offset: 1px;
    }
    .log {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .more {
      text-align: center;
      padding: 6px;
      font-size: 12px;
      color: var(--text-soft-color, #576273);
    }
    .empty {
      padding: 16px 14px;
      color: var(--text-soft-color, #576273);
    }
    form {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 8px;
      border-top: 1px solid var(--middle-color, #d2d2d2);
      flex-shrink: 0;
    }
    textarea {
      flex: 1;
      min-width: 0;
      resize: none;
      font: inherit;
      color: inherit;
      line-height: 1.4;
      max-height: 120px;
      padding: 6px 8px;
      box-sizing: border-box;
      background: var(--bg-soft-color, #f2f3f4);
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: calc(var(--radius, 4px) - 1px);
    }
    .send {
      flex-shrink: 0;
      height: 32px;
      padding: 0 12px;
      border: none;
      border-radius: var(--radius, 4px);
      background: var(--primary-color, #64d29b);
      color: var(--primary-text-color, #ffffff);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .send:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  @property() heading = 'Chat';
  @property({ attribute: false }) messages: EpChatEntry[] = [];
  @property() placeholder = 'Write a message';
  @property({ attribute: 'send-label' }) sendLabel = 'Send';
  @property({ attribute: 'close-label' }) closeLabel = 'Close';
  @property({ attribute: 'sticky-label' }) stickyLabel = 'Keep chat open';
  @property({ attribute: 'empty-label' }) emptyLabel = '';
  @property({ attribute: 'loading-label' }) loadingLabel = 'Loading…';
  /** Shows the sticky (pin) button and its state. */
  @property({ type: Boolean, reflect: true }) sticky = false;
  @property({ type: Boolean, attribute: 'show-sticky' }) showSticky = false;
  @property({ type: Boolean, attribute: 'show-close' }) showClose = false;
  /** Card look with shadow, for a floating chat box. */
  @property({ type: Boolean, reflect: true }) floating = false;
  /** Older messages can be loaded (`ep-chat-load-more` at the top). */
  @property({ type: Boolean, attribute: 'has-more' }) hasMore = false;
  /** Set while older messages are loading. */
  @property({ type: Boolean }) loading = false;
  /** Hides the input (read-only pad or chat disabled). */
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ type: Number }) maxlength = 1000;

  @query('.log') private _log!: HTMLElement;
  @query('textarea') private _input?: HTMLTextAreaElement;

  private _atBottom = true;
  private _loadingOlder = false;
  private _resize?: ResizeObserver;
  /** Message that stays in place while the reader is scrolled up. */
  private _anchor?: { el: Element; offset: number };
  @state() private _slotted = 0;

  /** Focuses the input. */
  focus(options?: FocusOptions) {
    this._input?.focus(options);
  }

  /** Scrolls to the newest message. */
  scrollToBottom() {
    if (this._log) this._log.scrollTop = this._log.scrollHeight;
    this._atBottom = true;
    this._anchor = undefined;
  }

  protected firstUpdated() {
    if (typeof ResizeObserver === 'function') {
      // Any height change of the content (new, older or re-rendered
      // messages, loading row, fonts) goes through _keepPosition.
      this._resize = new ResizeObserver(() => this._keepPosition());
      this._resize.observe(this.renderRoot.querySelector('.items')!);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._resize?.disconnect();
    this._resize = undefined;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('messages') || changed.has('hasMore')) this._loadingOlder = false;
    if (changed.has('loading') && !this.loading) this._loadingOlder = false;
    void this._afterRender();
  }

  /** Waits until the message elements have rendered, then keeps position. */
  private async _afterRender() {
    const items = this._messageElements() as Array<Element & { updateComplete?: Promise<unknown> }>;
    await Promise.all(items.map((m) => m.updateComplete));
    this._keepPosition();
  }

  private _messageElements(): Element[] {
    const own = Array.from(this.renderRoot.querySelectorAll('.items > ep-chat-message'));
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="messages"]');
    return own.concat(slot?.assignedElements({ flatten: true }) ?? []);
  }

  /** At the bottom: follow new messages. Scrolled up: keep the anchor still. */
  private _keepPosition() {
    const log = this._log;
    if (!log) return;
    if (this._atBottom) {
      log.scrollTop = log.scrollHeight;
      return;
    }
    const a = this._anchor;
    if (a && a.el.isConnected) {
      const delta = this._offsetOf(a.el) - a.offset;
      if (delta !== 0) log.scrollTop += delta;
    }
    this._recordAnchor();
  }

  private _offsetOf(el: Element): number {
    return el.getBoundingClientRect().top - this._log.getBoundingClientRect().top;
  }

  private _recordAnchor() {
    const top = this._log.getBoundingClientRect().top;
    const el = this._messageElements().find((m) => m.getBoundingClientRect().bottom > top);
    this._anchor = el ? { el, offset: this._offsetOf(el) } : undefined;
  }

  private _onSlotChange(e: Event) {
    this._slotted = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length;
    this._loadingOlder = false;
    void this._afterRender();
  }

  private _onScroll() {
    const log = this._log;
    this._atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    if (!this._atBottom) this._recordAnchor();
    if (log.scrollTop < 20 && this.hasMore && !this.loading && !this._loadingOlder) {
      this._loadingOlder = true;
      this.dispatchEvent(new CustomEvent('ep-chat-load-more', { bubbles: true, composed: true }));
    }
  }

  private _send(e?: Event) {
    e?.preventDefault();
    const input = this._input;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    this.dispatchEvent(new CustomEvent('ep-chat-send', {
      bubbles: true, composed: true, detail: { text },
    }));
    input.value = '';
    this._autosize();
    this._atBottom = true;
    this.requestUpdate();
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) this._send(e);
  }

  private _autosize() {
    const t = this._input;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  }

  private _toggleSticky() {
    this.sticky = !this.sticky;
    this.dispatchEvent(new CustomEvent('ep-chat-sticky', {
      bubbles: true, composed: true, detail: { sticky: this.sticky },
    }));
  }

  render() {
    const empty = !this.messages.length && !this._slotted;
    return html`
      <header part="header">
        <h2 id="heading"><slot name="heading">${this.heading}</slot></h2>
        <slot name="actions"></slot>
        ${this.showSticky ? html`
          <button class="icon-btn" part="sticky-button" type="button"
                  title=${this.stickyLabel} aria-label=${this.stickyLabel}
                  aria-pressed=${String(this.sticky)} @click=${this._toggleSticky}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.8 1.2a.75.75 0 0 1 1.06 0l3.94 3.94a.75.75 0 0 1 0 1.06l-1.1 1.1a.75.75 0 0 1-.83.16l-1.45 1.45.4 2.4a.75.75 0 0 1-.21.65l-.87.87a.75.75 0 0 1-1.06 0L7.4 10.56l-3.62 3.62a.75.75 0 1 1-1.06-1.06L6.34 9.5 4.07 7.23a.75.75 0 0 1 0-1.06l.87-.87a.75.75 0 0 1 .65-.21l2.4.4 1.45-1.45a.75.75 0 0 1 .16-.83z"/></svg>
          </button>` : nothing}
        ${this.showClose ? html`
          <button class="icon-btn" part="close-button" type="button"
                  title=${this.closeLabel} aria-label=${this.closeLabel}
                  @click=${() => this.dispatchEvent(new CustomEvent('ep-chat-close', { bubbles: true, composed: true }))}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
          </button>` : nothing}
      </header>
      <div class="log" part="log" role="log" aria-live="polite" aria-labelledby="heading"
           tabindex="0" @scroll=${this._onScroll}>
        <div class="items">
        ${this.loading ? html`<div class="more">${this.loadingLabel}</div>` : nothing}
        ${repeat(
          this.messages,
          (m, i) => m.id ?? i,
          (m) => html`<ep-chat-message author=${m.author} author-color=${m.authorColor ?? ''}
                        time=${m.time ?? ''} ?own=${!!m.own}>${m.text}</ep-chat-message>`,
        )}
        <slot name="messages" @slotchange=${this._onSlotChange}></slot>
        ${empty && this.emptyLabel ? html`<div class="empty" part="empty">${this.emptyLabel}</div>` : nothing}
        </div>
      </div>
      ${this.readonly ? nothing : html`
        <form part="form" @submit=${this._send}>
          <textarea part="input" rows="1" placeholder=${this.placeholder}
                    aria-label=${this.placeholder} maxlength=${this.maxlength}
                    @keydown=${this._onKeydown} @input=${this._autosize}></textarea>
          <button class="send" part="send-button" type="submit">${this.sendLabel}</button>
        </form>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-chat-panel': EpChatPanel;
  }
}
