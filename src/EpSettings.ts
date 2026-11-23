import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** Group of settings rows with a heading. */
@customElement('ep-settings-section')
export class EpSettingsSection extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      color: var(--text-color, #485365);
    }
    :host([hidden]) { display: none; }
    :host(:not(:first-of-type)) { margin-top: 20px; }
    h3 {
      margin: 0 0 4px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-soft-color, #576273);
    }
    .description {
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--text-soft-color, #576273);
    }
    .rows {
      display: flex;
      flex-direction: column;
    }
  `;

  @property() heading = '';
  @property() description = '';

  render() {
    return html`
      <section part="section" aria-labelledby=${this.heading ? 'h' : nothing}>
        ${this.heading ? html`<h3 id="h" part="heading">${this.heading}</h3>` : nothing}
        ${this.description ? html`<p class="description" part="description">${this.description}</p>` : nothing}
        <div class="rows" part="rows"><slot></slot></div>
      </section>
    `;
  }
}

/**
 * One setting: label (and optional description) on the left, the control
 * (slotted, e.g. `<ep-checkbox>`, `<ep-select>`, `<ep-segmented>`) on the
 * right. `stacked` puts the control below the label.
 *
 * Clicking the label activates a slotted `ep-checkbox` or focuses the
 * control.
 */
@customElement('ep-settings-row')
export class EpSettingsRow extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 0;
      min-height: 32px;
      font-family: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      font-size: 14px;
      color: var(--text-color, #485365);
    }
    :host([hidden]) { display: none; }
    :host([divided]) { border-top: 1px solid var(--middle-color, #d2d2d2); }
    :host([stacked]) {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }
    :host([disabled]) { opacity: 0.5; pointer-events: none; }
    .text {
      flex: 1;
      min-width: 0;
      cursor: default;
    }
    .label { font-weight: 600; }
    .description {
      margin-top: 2px;
      font-size: 12px;
      color: var(--text-soft-color, #576273);
    }
    .control {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    :host([stacked]) .control { justify-content: flex-start; }
  `;

  @property() label = '';
  @property() description = '';
  @property({ type: Boolean, reflect: true }) stacked = false;
  @property({ type: Boolean, reflect: true }) divided = false;
  @property({ type: Boolean, reflect: true }) disabled = false;

  private _control(): HTMLElement | undefined {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    return slot?.assignedElements({ flatten: true })[0] as HTMLElement | undefined;
  }

  updated() {
    this._nameControl();
  }

  /** Gives the control the row label as accessible name. */
  private _nameControl() {
    const control = this._control();
    if (!control || !this.label) return;
    if (control.tagName === 'EP-CHECKBOX') {
      if (!control.getAttribute('label')) control.setAttribute('accessible-name', this.label);
    } else if (!control.hasAttribute('aria-label') && !control.hasAttribute('aria-labelledby')) {
      control.setAttribute('aria-label', this.label);
    }
  }

  private _onLabelClick() {
    const control = this._control();
    if (!control) return;
    if (control.tagName === 'EP-CHECKBOX') {
      const input = control.shadowRoot?.querySelector('input');
      if (input) input.click();
      return;
    }
    control.focus();
  }

  render() {
    return html`
      <div class="text" part="text" @click=${this._onLabelClick}>
        <div class="label" part="label"><slot name="label">${this.label}</slot></div>
        ${this.description ? html`<div class="description" part="description">${this.description}</div>` : nothing}
      </div>
      <div class="control" part="control"><slot @slotchange=${this._nameControl}></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-settings-section': EpSettingsSection;
    'ep-settings-row': EpSettingsRow;
  }
}
