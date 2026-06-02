import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

type NotificationPosition = 'top' | 'bottom';
type NotificationType = 'success' | 'error' | 'info';

interface NotificationOptions {
  text: string;
  type?: NotificationType;
  duration?: number;
  position?: NotificationPosition;
}

const iconSvg: Record<string, string> = {
  success: `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
  error: `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>`,
  info: `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
};

const ensureContainer = (position: NotificationPosition): HTMLElement => {
  const id = `ep-notification-container-${position}`;
  let container = document.getElementById(id);
  if (container) return container;

  container = document.createElement('div');
  container.id = id;
  Object.assign(container.style, {
    position: 'fixed',
    [position === 'top' ? 'top' : 'bottom']: '16px',
    right: '16px',
    zIndex: '10000',
    display: 'flex',
    flexDirection: position === 'top' ? 'column' : 'column-reverse',
    gap: '8px',
    pointerEvents: 'none',
    maxWidth: '100vw',
    width: '420px',
  });
  document.body.appendChild(container);
  return container;
};

@customElement('ep-notification')
export class EpNotification extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      --ep-radius: 5px;
      --ep-shadow: 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08);

      display: block;
      pointer-events: auto;
      font-family: var(--ep-font);
      font-size: 14px;
      line-height: 1.5;
      max-width: 420px;
      width: 100%;
      box-sizing: border-box;
      opacity: 0;
      transform: translateY(calc(var(--ep-slide-dir, -1) * 12px));
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    :host([visible]) {
      opacity: 1;
      transform: translateY(0);
    }

    :host([removing]) {
      opacity: 0;
      transform: translateY(calc(var(--ep-slide-dir, -1) * 12px));
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .notification {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--ep-radius);
      box-shadow: var(--ep-shadow);
      background: var(--bg-color, white);
      color: var(--text-color, #485365);
      border-left: 3px solid var(--middle-color, #d2d2d2);
    }

    :host([type="success"]) .notification {
      border-left-color: var(--primary-color, #64d29b);
    }

    :host([type="error"]) .notification {
      border-left-color: #d1242f;
    }

    :host([type="info"]) .notification {
      border-left-color: var(--dark-color, #576273);
    }

    .icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-top: 1px;
    }

    :host([type="success"]) .icon { color: var(--primary-color, #64d29b); }
    :host([type="error"]) .icon { color: #d1242f; }
    :host([type="info"]) .icon { color: var(--dark-color, #576273); }

    .body { flex: 1; min-width: 0; word-wrap: break-word; }

    .close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--text-soft-color, #576273);
      cursor: pointer;
      padding: 0;
      opacity: 0.6;
      transition: opacity 0.15s ease;
      line-height: 1;
      font-size: 18px;
      width: 20px;
      height: 20px;
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

  @property({ reflect: true }) type: NotificationType = 'info';
  @property({ reflect: true }) position: NotificationPosition = 'top';
  @property({ type: Number }) duration = 3000;

  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.style.setProperty('--ep-slide-dir', this.position === 'bottom' ? '1' : '-1');
    requestAnimationFrame(() => this.setAttribute('visible', ''));
    this._startAutoClose();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearTimer();
  }

  dismiss() {
    this._clearTimer();
    this.removeAttribute('visible');
    this.setAttribute('removing', '');
    const onDone = () => {
      this.removeEventListener('transitionend', onDone);
      this.remove();
      for (const pos of ['top', 'bottom'] as const) {
        const c = document.getElementById(`ep-notification-container-${pos}`);
        if (c && c.children.length === 0) c.remove();
      }
    };
    this.addEventListener('transitionend', onDone);
    setTimeout(onDone, 350);
  }

  render() {
    const icon = iconSvg[this.type] ?? iconSvg.info;
    return html`
      <div class="notification" role="alert" aria-live="assertive">
        ${unsafeHTML(icon)}
        <div class="body"><slot></slot></div>
        <button class="close" aria-label="Close notification"
                @click="${() => this.dismiss()}">&times;</button>
      </div>
    `;
  }

  private _startAutoClose() {
    if (this.duration > 0) {
      this._dismissTimer = setTimeout(() => this.dismiss(), this.duration);
    }
  }

  private _clearTimer() {
    if (this._dismissTimer != null) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }

  static show(options: NotificationOptions): EpNotification {
    const el = document.createElement('ep-notification') as EpNotification;
    el.type = options.type ?? 'info';
    el.duration = options.duration ?? 3000;
    el.position = options.position ?? 'top';
    el.textContent = options.text;
    ensureContainer(el.position).appendChild(el);
    return el;
  }

  static success(text: string, duration?: number) {
    return EpNotification.show({ text, type: 'success', duration });
  }

  static error(text: string, duration?: number) {
    return EpNotification.show({ text, type: 'error', duration: duration ?? 5000 });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-notification': EpNotification;
  }
}
