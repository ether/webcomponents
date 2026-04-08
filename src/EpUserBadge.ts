import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-user-badge')
export class EpUserBadge extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--ep-font);
      font-size: 14px;
      color: var(--text-color, #485365);
    }

    .avatar {
      width: var(--ep-badge-size, 24px);
      height: var(--ep-badge-size, 24px);
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: white;
      text-transform: uppercase;
    }

    :host([size="small"]) .avatar {
      --ep-badge-size: 18px;
      font-size: 9px;
    }

    :host([size="large"]) .avatar {
      --ep-badge-size: 32px;
      font-size: 14px;
    }

    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
      font-weight: 500;
    }

    :host([online]) .avatar {
      box-shadow: 0 0 0 2px var(--bg-color, white), 0 0 0 3px var(--text-soft-color, #576273);
    }
  `;

  @property() name = '';
  @property() color = '#485365';
  @property({ reflect: true }) size: 'small' | 'medium' | 'large' = 'medium';
  @property({ type: Boolean, reflect: true }) online = false;

  render() {
    const initial = this.name ? this.name.charAt(0) : '?';
    return html`
      <div class="avatar" style="background: ${this.color}">
        ${initial}
      </div>
      ${this.name ? html`<span class="name">${this.name}</span>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-user-badge': EpUserBadge;
  }
}
