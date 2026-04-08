import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-chat-message')
export class EpChatMessage extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: block;
      font-family: var(--ep-font);
      font-size: 14px;
      color: var(--text-color, #485365);
      padding: 6px 10px;
    }

    :host(:first-child) { padding-top: 10px; }
    :host(:last-child) { padding-bottom: 10px; }

    .header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 2px;
    }

    .author {
      font-weight: 700;
      font-size: 13px;
    }

    .time {
      font-size: 11px;
      color: var(--text-soft-color, #576273);
    }

    .body {
      line-height: 1.5;
      word-wrap: break-word;
    }

    :host([own]) {
      background: var(--bg-soft-color, #f2f3f4);
      border-radius: 4px;
      margin: 2px 0;
    }
  `;

  @property() author = '';
  @property({ attribute: 'author-color' }) authorColor = '';
  @property() time = '';
  @property({ type: Boolean, reflect: true }) own = false;

  render() {
    return html`
      <div class="header">
        <span class="author" style="${this.authorColor ? `color: ${this.authorColor}` : ''}">${this.author}</span>
        ${this.time ? html`<span class="time">${this.time}</span>` : ''}
      </div>
      <div class="body">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-chat-message': EpChatMessage;
  }
}
