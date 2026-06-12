import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-chat-message')
export class EpChatMessage extends LitElement {
  static styles = css`
    /* Matches Etherpad colibris chat: a plain message line (#chattext p),
       padding 4px 10px, bold author, muted inline time, then the text. No
       bubbles — Etherpad does not style own vs other messages differently. */
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: block;
      font-family: var(--ep-font);
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-color, #485365);
      padding: 4px 10px;
      word-wrap: break-word;
    }

    :host(:first-child) { padding-top: 10px; }
    :host(:last-child) { padding-bottom: 10px; }

    .author {
      font-weight: bold;
    }

    .time {
      font-size: 11px;
      color: var(--text-soft-color, #576273);
      margin: 0 4px 0 6px;
    }

    .body { display: inline; }

    /* authorColors mode: Etherpad tints the whole message with the author
       colour. Opt-in via the own flag to keep the default view plain. */
    :host([own]) {
      background: var(--bg-soft-color, #f2f3f4);
    }
  `;

  @property() author = '';
  @property({ attribute: 'author-color' }) authorColor = '';
  @property() time = '';
  @property({ type: Boolean, reflect: true }) own = false;

  render() {
    return html`
      <b class="author" style="${this.authorColor ? `color: ${this.authorColor}` : ''}">${this.author}</b>${this.time ? html`<span class="time">${this.time}</span>` : html`<span class="time"></span>`}<span class="body"><slot></slot></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-chat-message': EpChatMessage;
  }
}
