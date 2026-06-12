import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export interface EpSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * `<ep-select>` — a styled form select, matching Etherpad colibris's
 * nice-select look (the plugin Etherpad uses to skin native `<select>`s).
 *
 * @fires ep-select:change - When a value is chosen. Detail: `{ value, label }`
 */
@customElement('ep-select')
export class EpSelect extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-block;
      font-family: var(--ep-font);
      font-size: 14px;
    }

    /* The box — base nice-select geometry + colibris colours. */
    .nice-select {
      position: relative;
      box-sizing: border-box;
      display: inline-block;
      width: 100%;
      min-width: 100px;
      height: 28px;
      line-height: 28px;
      padding: 0 25px 0 10px;
      border-radius: 3px;
      border: 1px solid var(--bg-soft-color, #f2f3f4);
      background-color: var(--bg-soft-color, #f2f3f4);
      color: var(--text-color, #485365);
      font-weight: bold;
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      user-select: none;
      transition: border-color 0.1s ease-in-out;
    }
    .nice-select:hover { border-color: var(--middle-color, #d2d2d2); }
    .nice-select:focus-visible { border-color: var(--dark-color, #576273); }

    .current { display: block; overflow: hidden; text-overflow: ellipsis; }
    :host(:not([value])) .current,
    .current.placeholder { color: var(--text-soft-color, #576273); font-weight: normal; }

    /* Chevron */
    .nice-select::after {
      content: '';
      position: absolute;
      top: 50%;
      right: 12px;
      width: 5px;
      height: 5px;
      margin-top: -4px;
      border-bottom: 2px solid var(--text-soft-color, #999);
      border-right: 2px solid var(--text-soft-color, #999);
      transform-origin: 66% 66%;
      transform: rotate(45deg);
      transition: transform 0.15s ease-in-out;
      pointer-events: none;
    }
    :host([open]) .nice-select::after { transform: rotate(-135deg); }

    /* Dropdown list */
    .list {
      list-style: none;
      margin: 4px 0 0;
      padding: 4px 0;
      position: absolute;
      top: 100%;
      left: 0;
      min-width: 100%;
      box-sizing: border-box;
      background-color: var(--bg-soft-color, #f2f3f4);
      border-radius: 3px;
      box-shadow: 0 0 0 1px rgba(68, 68, 68, 0.11), 0 8px 16px rgba(27, 39, 51, 0.12);
      opacity: 0;
      pointer-events: none;
      max-height: 0;
      overflow: auto;
      z-index: 9;
      transform-origin: 50% 0;
      transform: scale(0.75) translateY(-12px);
      transition: transform 0.2s cubic-bezier(0.5, 0, 0.08, 1.1), opacity 0.15s ease-out;
    }
    :host([open]) .list {
      opacity: 1;
      pointer-events: auto;
      max-height: 260px;
      transform: scale(1) translateY(0);
    }

    .option {
      padding: 0 15px;
      min-height: 35px;
      line-height: 35px;
      cursor: pointer;
      white-space: nowrap;
      font-weight: normal;
      color: var(--text-color, #485365);
      transition: background-color 0.2s;
    }
    .option:hover,
    .option.focus,
    .option.selected.focus { background-color: var(--bg-color, #ffffff); }
    .option.selected { font-weight: bold; }
    .option.disabled {
      color: var(--text-soft-color, #999);
      background-color: transparent;
      cursor: default;
    }

    /* Disabled box */
    :host([disabled]) .nice-select {
      color: var(--text-soft-color, #999);
      pointer-events: none;
      opacity: 0.7;
    }
    :host([disabled]) .nice-select::after { border-color: var(--middle-color, #ccc); }
  `;

  @property({ type: Array }) options: EpSelectOption[] = [];
  @property({ reflect: true }) value = '';
  @property() placeholder = '';
  @property() name = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _focusIndex = -1;

  private _onDocClick = (e: MouseEvent) => {
    if (this.open && !e.composedPath().includes(this)) this.open = false;
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onDocClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocClick);
  }

  private get _selected(): EpSelectOption | undefined {
    return this.options.find((o) => o.value === this.value);
  }

  private _toggle() {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      const sel = this.options.findIndex((o) => o.value === this.value);
      this._focusIndex = sel >= 0 ? sel : this._firstEnabled();
    }
  }

  private _firstEnabled(): number {
    return this.options.findIndex((o) => !o.disabled);
  }

  private _select(opt: EpSelectOption, e?: Event) {
    e?.stopPropagation();
    if (opt.disabled) return;
    this.value = opt.value;
    this.open = false;
    this.dispatchEvent(new CustomEvent('ep-select:change', {
      detail: { value: opt.value, label: opt.label },
      bubbles: true,
      composed: true,
    }));
  }

  private _move(dir: 1 | -1) {
    const n = this.options.length;
    let i = this._focusIndex;
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n;
      if (!this.options[i]?.disabled) { this._focusIndex = i; break; }
    }
  }

  private _onKeydown(e: KeyboardEvent) {
    if (this.disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (this.open && this._focusIndex >= 0) this._select(this.options[this._focusIndex]);
        else this._toggle();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) this._toggle();
        else this._move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.open) this._move(-1);
        break;
      case 'Escape':
        this.open = false;
        break;
    }
  }

  render() {
    const sel = this._selected;
    return html`
      <div
        class="nice-select"
        part="select"
        role="listbox"
        aria-expanded="${this.open}"
        tabindex="${this.disabled ? -1 : 0}"
        @click="${this._toggle}"
        @keydown="${this._onKeydown}"
      >
        <span class="current ${classMap({ placeholder: !sel })}">${sel ? sel.label : this.placeholder}</span>
        <ul class="list" part="list" role="presentation">
          ${this.options.map((o, i) => html`
            <li
              class="option ${classMap({ selected: o.value === this.value, disabled: !!o.disabled, focus: i === this._focusIndex })}"
              role="option"
              aria-selected="${o.value === this.value}"
              data-value="${o.value}"
              @click="${(e: Event) => this._select(o, e)}"
            >${o.label}</li>
          `)}
        </ul>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-select': EpSelect;
  }
}
