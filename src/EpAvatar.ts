import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { initialsOf, readableTextOn, safeColor } from './internal/color.js';

/**
 * Round user avatar: a picture if `src` is set and loads, otherwise the
 * initials on the author colour (with readable text colour).
 */
@customElement('ep-avatar')
export class EpAvatar extends LitElement {
  static styles = css`
    :host {
      --ep-avatar-size: 28px;
      display: inline-block;
      position: relative;
      width: var(--ep-avatar-size);
      height: var(--ep-avatar-size);
      flex-shrink: 0;
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
    }
    :host([size="small"]) { --ep-avatar-size: 20px; }
    :host([size="large"]) { --ep-avatar-size: 40px; }

    .circle {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: calc(var(--ep-avatar-size) * 0.4);
      line-height: 1;
      user-select: none;
      box-sizing: border-box;
    }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .status {
      position: absolute;
      right: -1px;
      bottom: -1px;
      width: calc(var(--ep-avatar-size) * 0.3);
      height: calc(var(--ep-avatar-size) * 0.3);
      min-width: 7px;
      min-height: 7px;
      border-radius: 50%;
      border: 2px solid var(--bg-color, #ffffff);
      box-sizing: content-box;
    }
    .status.online { background: var(--success-color, var(--primary-color, #64d29b)); }
    .status.idle { background: var(--warning-color, #d4a72c); }
    .status.offline { background: var(--middle-color, #d2d2d2); }
  `;

  @property() name = '';
  /** Background colour (author colour). */
  @property() color = '';
  /** Optional picture URL. */
  @property() src = '';
  @property({ reflect: true }) size: 'small' | 'medium' | 'large' = 'medium';
  /** Small status dot: `online`, `idle`, `offline` or empty for none. */
  @property({ reflect: true }) status: '' | 'online' | 'idle' | 'offline' = '';

  @state() private _imgFailed = false;

  updated(changed: Map<string, unknown>) {
    if (changed.has('src')) this._imgFailed = false;
  }

  render() {
    const color = safeColor(this.color);
    const bg = color || 'var(--text-soft-color, #576273)';
    const fg = color ? readableTextOn(color) : 'var(--bg-color, #ffffff)';
    const showImg = this.src && !this._imgFailed;
    return html`
      <div class="circle" part="circle" role="img" aria-label=${this.name || nothing}
           style=${styleMap({ background: bg, color: fg })}>
        ${showImg
          ? html`<img src=${this.src} alt="" @error=${() => { this._imgFailed = true; }} />`
          : html`<span aria-hidden="true">${initialsOf(this.name)}</span>`}
      </div>
      ${this.status ? html`<span class="status ${this.status}" part="status"></span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-avatar': EpAvatar;
  }
}
