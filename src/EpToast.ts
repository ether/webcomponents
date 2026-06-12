import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

const toastIconSvg: Record<string, string> = {
  success: `<svg class="icon" viewBox="0 0 16 16" fill="var(--primary-color, #64d29b)"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>`,
  error: `<svg class="icon" viewBox="0 0 16 16" fill="#d1242f"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-9.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM8 11a1 1 0 100 2 1 1 0 000-2z"/></svg>`,
  info: `<svg class="icon" viewBox="0 0 16 16" fill="var(--dark-color, #576273)"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-9.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM8 11a1 1 0 100 2 1 1 0 000-2z"/></svg>`,
};

@customElement('ep-toast-item')
export class EpToastItem extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);

      display: block;
      pointer-events: auto;
      font-family: var(--ep-font);
      font-size: 14px;
      line-height: 1.5;
      opacity: 0;
      transform: translateX(16px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    :host([visible]) {
      opacity: 1;
      transform: translateX(0);
    }

    :host([removing]) {
      opacity: 0;
      transform: translateX(16px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    :host([slide-from="left"]) { transform: translateX(-16px); }
    :host([slide-from="left"][visible]) { transform: translateX(0); }
    :host([slide-from="left"][removing]) { transform: translateX(-16px); }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 5px;
      box-shadow: 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08);
      background: var(--bg-color, white);
      color: var(--text-color, #485365);
      border-left: 3px solid var(--middle-color, #d2d2d2);
    }

    :host([type="success"]) .toast { border-left-color: var(--primary-color, #64d29b); }
    :host([type="error"]) .toast { border-left-color: #d1242f; }
    :host([type="info"]) .toast { border-left-color: var(--dark-color, #576273); }

    .icon { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; }
    .message { flex: 1; min-width: 0; word-wrap: break-word; }

    .close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--text-soft-color, #576273);
      cursor: pointer;
      padding: 0;
      opacity: 0.5;
      transition: opacity 0.15s ease;
      font-size: 16px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close:hover, .close:focus-visible { opacity: 1; }
    .close:focus-visible {
      outline: 2px solid var(--primary-color, #64d29b);
      outline-offset: 2px;
      border-radius: 2px;
    }
  `;

  @property({ reflect: true }) type: ToastType = 'info';
  @property() message = '';
  @property({ type: Number }) duration = 4000;

  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => this.setAttribute('visible', ''));
    if (this.duration > 0) {
      this._dismissTimer = setTimeout(() => this.dismiss(), this.duration);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._dismissTimer != null) clearTimeout(this._dismissTimer);
  }

  dismiss() {
    if (this._dismissTimer != null) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
    this.removeAttribute('visible');
    this.setAttribute('removing', '');
    const cleanup = () => {
      this.removeEventListener('transitionend', cleanup);
      this.remove();
    };
    this.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 300);
  }

  render() {
    const icon = toastIconSvg[this.type] ?? toastIconSvg.info;
    return html`
      <div class="toast" role="status" aria-live="polite">
        ${unsafeHTML(icon)}
        <span class="message">${this.message}</span>
        <button class="close" aria-label="Dismiss"
                @click="${() => this.dismiss()}">&times;</button>
      </div>
    `;
  }
}

const MAX_VISIBLE = 5;

@customElement('ep-toast-container')
export class EpToastContainer extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      z-index: 10002;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 380px;
      width: 100%;
      font-size: 14px;
    }

    :host([position="top-right"]), :host(:not([position])) {
      top: 16px; right: 16px;
    }
    :host([position="top-left"]) { top: 16px; left: 16px; }
    :host([position="bottom-right"]) {
      bottom: 16px; right: 16px; flex-direction: column-reverse;
    }
    :host([position="bottom-left"]) {
      bottom: 16px; left: 16px; flex-direction: column-reverse;
    }
  `;

  @property({ reflect: true }) position: ToastPosition = 'top-right';

  private static _instance: EpToastContainer | null = null;

  connectedCallback() {
    super.connectedCallback();
    EpToastContainer._instance = this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (EpToastContainer._instance === this) EpToastContainer._instance = null;
  }

  render() {
    return html`<slot></slot>`;
  }

  static getInstance(): EpToastContainer {
    if (EpToastContainer._instance) return EpToastContainer._instance;
    const container = document.createElement('ep-toast-container') as EpToastContainer;
    container.position = 'top-right';
    document.body.appendChild(container);
    return container;
  }

  addToast(options: ToastOptions): EpToastItem {
    const existing = this.querySelectorAll('ep-toast-item');
    if (existing.length >= MAX_VISIBLE) {
      (existing[0] as EpToastItem).dismiss();
    }

    const toast = document.createElement('ep-toast-item') as EpToastItem;
    toast.message = options.message;
    toast.type = options.type ?? 'info';
    toast.duration = options.duration ?? 4000;

    if (this.position.includes('left')) {
      toast.setAttribute('slide-from', 'left');
    }

    this.appendChild(toast);
    return toast;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-toast-item': EpToastItem;
    'ep-toast-container': EpToastContainer;
  }
}
