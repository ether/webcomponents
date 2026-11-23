import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import './EpAvatar.js';
import { safeColor } from './internal/color.js';

export interface EpUser {
  id: string;
  name: string;
  color: string;
  /** The current user: shown first, name and colour can be changed. */
  self?: boolean;
  status?: '' | 'online' | 'idle' | 'offline';
}

/**
 * List of the users in a pad. The own entry has a name field and a colour
 * button.
 *
 * Events:
 * - `ep-user-rename` (detail `{ name }`) when the own name is committed
 *   (Enter or leaving the field),
 * - `ep-user-color-request` (detail `{ anchor }`) when the colour button is
 *   clicked; the app opens its colour picker at `anchor`,
 * - `ep-user-select` (detail `{ user }`) when another user is clicked.
 */
@customElement('ep-user-list')
export class EpUserList extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      font-size: 14px;
      color: var(--text-color, #485365);
    }
    .heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-soft-color, #576273);
    }
    ul { list-style: none; margin: 0; padding: 0; }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border-radius: var(--radius, 4px);
      min-height: 32px;
    }
    li.other { cursor: default; }
    li.other[data-clickable] { cursor: pointer; }
    li.other[data-clickable]:hover { background: var(--bg-soft-color, #f2f3f4); }
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .unnamed { color: var(--text-soft-color, #576273); font-style: italic; }
    .color-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid var(--bg-color, #ffffff);
      box-shadow: 0 0 0 1px var(--middle-color, #d2d2d2);
      cursor: pointer;
      flex-shrink: 0;
    }
    .color-btn:focus-visible, input:focus-visible, li[data-clickable]:focus-visible {
      outline: 2px solid var(--focus-color, var(--dark-color, #576273));
      outline-offset: 2px;
    }
    input {
      flex: 1;
      min-width: 0;
      font: inherit;
      color: inherit;
      background: var(--bg-soft-color, #f2f3f4);
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: calc(var(--radius, 4px) - 1px);
      padding: 5px 8px;
    }
    input:disabled { opacity: 0.6; }
    .empty { color: var(--text-soft-color, #576273); padding: 6px 8px; }
  `;

  @property({ attribute: false }) users: EpUser[] = [];
  /** Heading above the list; empty hides it. */
  @property() heading = '';
  @property({ attribute: 'name-placeholder' }) namePlaceholder = 'Enter your name';
  @property({ attribute: 'unnamed-label' }) unnamedLabel = 'Unnamed';
  @property({ attribute: 'color-label' }) colorLabel = 'Change your colour';
  @property({ attribute: 'empty-label' }) emptyLabel = '';
  /** Others can be clicked (`ep-user-select`). */
  @property({ type: Boolean }) selectable = false;
  /** Own name and colour cannot be changed (read-only pad). */
  @property({ type: Boolean, reflect: true }) readonly = false;

  private _committed = '';

  private get _sorted(): EpUser[] {
    const self = this.users.filter((u) => u.self);
    const others = this.users
      .filter((u) => !u.self)
      .sort((a, b) => (a.name || '￿').localeCompare(b.name || '￿'));
    return [...self, ...others];
  }

  private _commit(input: HTMLInputElement) {
    const name = input.value.trim();
    if (name === this._committed) return;
    this._committed = name;
    this.dispatchEvent(new CustomEvent('ep-user-rename', {
      bubbles: true, composed: true, detail: { name },
    }));
  }

  private _requestColor(e: Event) {
    this.dispatchEvent(new CustomEvent('ep-user-color-request', {
      bubbles: true, composed: true, detail: { anchor: e.currentTarget },
    }));
  }

  private _select(user: EpUser) {
    if (!this.selectable) return;
    this.dispatchEvent(new CustomEvent('ep-user-select', {
      bubbles: true, composed: true, detail: { user },
    }));
  }

  private _renderSelf(u: EpUser) {
    this._committed = u.name ?? '';
    return html`
      <li class="self" part="item self">
        <button class="color-btn" part="color-button" type="button"
                title=${this.colorLabel} aria-label=${this.colorLabel}
                ?disabled=${this.readonly}
                style=${styleMap({ background: safeColor(u.color) })}
                @click=${this._requestColor}></button>
        <input part="name-input" .value=${u.name ?? ''} placeholder=${this.namePlaceholder}
               aria-label=${this.namePlaceholder} maxlength="50"
               ?disabled=${this.readonly}
               @keydown=${(e: KeyboardEvent) => {
                 if (e.key === 'Enter') { e.preventDefault(); this._commit(e.target as HTMLInputElement); }
                 if (e.key === 'Escape') { (e.target as HTMLInputElement).value = this._committed; }
               }}
               @blur=${(e: FocusEvent) => this._commit(e.target as HTMLInputElement)} />
      </li>`;
  }

  private _renderOther(u: EpUser) {
    const clickable = this.selectable;
    return html`
      <li class="other" part="item"
          ?data-clickable=${clickable}
          tabindex=${clickable ? '0' : nothing}
          role=${clickable ? 'button' : nothing}
          @click=${() => this._select(u)}
          @keydown=${(e: KeyboardEvent) => {
            if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this._select(u); }
          }}>
        <ep-avatar name=${u.name} color=${u.color} size="small" status=${u.status ?? ''}></ep-avatar>
        <span class="name ${u.name ? '' : 'unnamed'}">${u.name || this.unnamedLabel}</span>
      </li>`;
  }

  render() {
    const users = this._sorted;
    return html`
      ${this.heading
        ? html`<div class="heading" part="heading"><span>${this.heading}</span><span>${users.length}</span></div>`
        : nothing}
      <ul part="list" aria-label=${this.heading || nothing}>
        ${users.map((u) => (u.self ? this._renderSelf(u) : this._renderOther(u)))}
      </ul>
      ${users.length <= 1 && this.emptyLabel ? html`<div class="empty" part="empty">${this.emptyLabel}</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-user-list': EpUserList;
  }
}
