import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ep-card')
export class EpCard extends LitElement {
  static styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: block;
      font-family: var(--ep-font);
      font-size: 14px;
      color: var(--text-color, #485365);
    }

    .card {
      background: var(--bg-color, white);
      border-radius: 5px;
      box-shadow: 0 0 0 1px rgba(99, 114, 130, 0.16), 0 8px 16px rgba(27, 39, 51, 0.08);
      overflow: hidden;
    }

    :host([bordered]) .card {
      box-shadow: none;
      border: 1px solid var(--middle-color, #d2d2d2);
    }

    .header {
      padding: 20px 25px 0;
    }

    .header:empty { display: none; }

    .title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      line-height: 1.4;
      color: var(--text-color, #485365);
    }

    .subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-soft-color, #576273);
    }

    .body {
      padding: 20px 25px;
      line-height: 1.6;
    }

    :host([compact]) .body {
      padding: 12px 16px;
    }

    :host([compact]) .header {
      padding: 12px 16px 0;
    }

    .footer {
      padding: 0 25px 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    :host([compact]) .footer {
      padding: 0 16px 12px;
    }

    .footer:empty { display: none; }

    .divider {
      border: none;
      border-top: 1px solid var(--bg-soft-color, #f2f3f4);
      margin: 0;
    }
  `;

  @property({ attribute: 'card-title' }) cardTitle = '';
  @property() subtitle = '';
  @property({ type: Boolean, reflect: true }) bordered = false;
  @property({ type: Boolean, reflect: true }) compact = false;

  render() {
    const hasHeader = this.cardTitle || this.subtitle;
    return html`
      <div class="card" part="card">
        ${hasHeader ? html`
          <div class="header" part="header">
            ${this.cardTitle ? html`<h3 class="title">${this.cardTitle}</h3>` : ''}
            ${this.subtitle ? html`<p class="subtitle">${this.subtitle}</p>` : ''}
          </div>
        ` : ''}
        <div class="body" part="body">
          <slot></slot>
        </div>
        <div class="footer" part="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-card': EpCard;
  }
}
