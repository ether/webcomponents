import { LitElement, html, css, PropertyValues } from 'lit';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
}

export class EpModal extends LitElement {
  static override properties = {
    open:       { type: Boolean, reflect: true },
    modalTitle: { attribute: 'modal-title' },
  };

  static override styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: var(--ep-font);
      font-size: 14px;
      color: var(--text-color, #485365);
    }
    :host([open]) { display: flex; }
    .overlay {
      position: fixed; inset: 0;
      background: rgba(72, 83, 101, 0.3);
      animation: ep-modal-fade-in 0.15s ease;
    }
    .dialog {
      position: relative; z-index: 1;
      background: var(--bg-color, white);
      border-radius: 5px;
      box-shadow: 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08);
      max-width: 480px; width: calc(100vw - 32px);
      max-height: calc(100vh - 64px); overflow: auto;
      animation: ep-modal-scale-in 0.2s ease; outline: none;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 25px 0;
    }
    .title { margin: 0; font-size: 1.2rem; font-weight: 700; line-height: 1.4; color: var(--text-color, #485365); }
    .close-btn {
      background: none; border: none; cursor: pointer; padding: 4px;
      margin: -4px -4px 0 8px; color: var(--text-soft-color, #576273);
      opacity: 0.5; transition: opacity 0.15s ease; font-size: 18px; line-height: 1;
      display: flex; align-items: center; justify-content: center; border-radius: 4px;
    }
    .close-btn:hover, .close-btn:focus-visible { opacity: 1; }
    .close-btn:focus-visible { outline: 2px solid var(--primary-color, #64d29b); outline-offset: 2px; }
    .body { padding: 20px 25px; line-height: 1.6; }
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 0 25px 20px; }
    .actions ::slotted(button), .actions button {
      padding: 5px 20px; border-radius: 4px; font-size: 14px; font-weight: 700;
      text-transform: uppercase; cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      font-family: inherit; line-height: 1.5;
    }
    .btn-cancel { background: transparent; border: 1px solid var(--middle-color, #d2d2d2); color: var(--text-color, #485365); }
    .btn-cancel:hover { background: var(--bg-soft-color, #f2f3f4); }
    .btn-confirm { background: var(--text-color, #485365); border: 1px solid var(--text-color, #485365); color: white; }
    .btn-confirm:hover { background: var(--dark-color, #576273); }
    .prompt-input {
      width: 100%; box-sizing: border-box; padding: 8px 10px;
      border: 1px solid var(--middle-color, #d2d2d2); border-radius: 3px;
      font-size: 14px; font-family: inherit;
      background: var(--bg-soft-color, #f2f3f4); color: var(--text-color, #485365);
      margin-top: 12px; outline: none; transition: border-color 0.15s ease;
    }
    .prompt-input:focus { border-color: var(--dark-color, #576273); }
    .prompt-input::placeholder { color: var(--text-soft-color, #576273); }
    @keyframes ep-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ep-modal-scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  `;

  open: boolean;
  modalTitle: string;

  private _previousFocus: HTMLElement | null = null;
  private _boundKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    super();
    this.open = false;
    this.modalTitle = '';
    this._boundKeyDown = this._handleKeyDown.bind(this);
  }

  protected override updated(changed: PropertyValues) {
    if (changed.has('open')) {
      if (this.open) this._onOpen();
      else this._onClose();
    }
  }

  close(action?: string) {
    this.dispatchEvent(new CustomEvent('ep-modal-close', {
      bubbles: true, composed: true, detail: { action },
    }));
    this.open = false;
  }

  protected override render() {
    return html`
      <div class="overlay" part="overlay" @click="${() => this.close()}"></div>
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="ep-modal-title" tabindex="-1">
        <div class="header">
          <h2 class="title" id="ep-modal-title">${this.modalTitle}</h2>
          <button class="close-btn" aria-label="Close"
                  @click="${() => this.close()}">&times;</button>
        </div>
        <div class="body"><slot></slot></div>
        <div class="actions"><slot name="actions"></slot></div>
      </div>
    `;
  }

  private _onOpen() {
    this._previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    document.addEventListener('keydown', this._boundKeyDown);
    const dialog = this.renderRoot?.querySelector<HTMLElement>('.dialog');
    requestAnimationFrame(() => dialog?.focus());
  }

  private _onClose() {
    document.removeEventListener('keydown', this._boundKeyDown);
    this._previousFocus?.focus();
    this._previousFocus = null;
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key === 'Tab') this._trapFocus(e);
  }

  private _trapFocus(e: KeyboardEvent) {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const shadowEls = Array.from(this.renderRoot.querySelectorAll<HTMLElement>(selector));
    const lightEls = Array.from(this.querySelectorAll<HTMLElement>(selector));
    const focusable = [...shadowEls, ...lightEls].filter(
      el => !el.hasAttribute('disabled') && el.offsetParent !== null,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = (this.renderRoot as ShadowRoot).activeElement ?? document.activeElement;
    if (e.shiftKey) {
      if (active === first || !focusable.includes(active as HTMLElement)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !focusable.includes(active as HTMLElement)) { e.preventDefault(); first.focus(); }
    }
  }

  static confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const modal = document.createElement('ep-modal') as EpModal;
      modal.modalTitle = options.title;
      const body = document.createElement('p');
      body.textContent = options.message;
      body.style.margin = '0';
      modal.appendChild(body);
      const actions = document.createElement('div');
      actions.setAttribute('slot', 'actions');
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = options.cancelText ?? 'Cancel';
      cancelBtn.addEventListener('click', () => { resolve(false); modal.remove(); });
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = options.confirmText ?? 'Confirm';
      confirmBtn.addEventListener('click', () => { resolve(true); modal.remove(); });
      actions.append(cancelBtn, confirmBtn);
      modal.appendChild(actions);
      document.body.appendChild(modal);
      modal.addEventListener('ep-modal-close', () => { resolve(false); modal.remove(); });
      modal.open = true;
    });
  }

  static prompt(options: PromptOptions): Promise<string | null> {
    return new Promise<string | null>(resolve => {
      const modal = document.createElement('ep-modal') as EpModal;
      modal.modalTitle = options.title;
      const container = document.createElement('div');
      const msg = document.createElement('p');
      msg.textContent = options.message;
      msg.style.margin = '0';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = options.placeholder ?? '';
      input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--middle-color,#d2d2d2);border-radius:3px;font-size:14px;margin-top:12px;outline:none;background:var(--bg-soft-color,#f2f3f4);color:var(--text-color,#485365);';
      container.append(msg, input);
      modal.appendChild(container);
      const actions = document.createElement('div');
      actions.setAttribute('slot', 'actions');
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => { resolve(null); modal.remove(); });
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'OK';
      confirmBtn.addEventListener('click', () => { resolve(input.value); modal.remove(); });
      actions.append(cancelBtn, confirmBtn);
      modal.appendChild(actions);
      document.body.appendChild(modal);
      modal.addEventListener('ep-modal-close', () => { resolve(null); modal.remove(); });
      modal.open = true;
      requestAnimationFrame(() => input.focus());
    });
  }
}

if (!customElements.get('ep-modal')) {
  customElements.define('ep-modal', EpModal);
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-modal': EpModal;
  }
}
