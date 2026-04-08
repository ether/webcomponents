import { LitElement, html, css, PropertyValues } from 'lit';

// ---------------------------------------------------------------------------
// Color math (HSL ↔ RGB, all values 0..1)
// ---------------------------------------------------------------------------

function hueToRGB(m1: number, m2: number, h: number): number {
  if (h < 0) h++;
  if (h > 1) h--;
  if (h * 6 < 1) return m1 + (m2 - m1) * h * 6;
  if (h * 2 < 1) return m2;
  if (h * 3 < 2) return m1 + (m2 - m1) * (2 / 3 - h) * 6;
  return m1;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
  const m1 = l * 2 - m2;
  return [hueToRGB(m1, m2, h + 1 / 3), hueToRGB(m1, m2, h), hueToRGB(m1, m2, h - 1 / 3)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function rgbToHex(r: number, g: number, b: number): string {
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function luminance(r: number, g: number, b: number): number {
  return r * 0.3 + g * 0.59 + b * 0.11;
}

// Angle offset: hue 0 (red) at 12 o'clock
const ANGLE_OFFSET = -Math.PI / 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class EpColorWheel extends LitElement {
  static override properties = {
    size:      { type: Number },
    value:     { type: String },
    showInput: { type: Boolean, attribute: 'show-input' },
    _hsl:      { state: true },
  };

  static override styles = css`
    :host {
      --ep-font: var(--main-font-family, Quicksand, Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
      display: inline-block;
      font-family: var(--ep-font);
      user-select: none;
      -webkit-user-select: none;
    }
    .wrapper {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .container {
      position: relative;
      border-radius: 50%;
      box-shadow:
        0 0 0 1px rgba(99, 114, 130, 0.08),
        0 4px 20px rgba(27, 39, 51, 0.10);
      cursor: crosshair;
    }
    canvas { position: absolute; top: 0; left: 0; pointer-events: none; }
    canvas.overlay { pointer-events: none; }
    .solid { position: absolute; border-radius: 3px; }
    .preview-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--bg-color, white);
      border: 1px solid var(--middle-color, #d2d2d2);
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .swatch-preview {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--middle-color, #d2d2d2);
      flex-shrink: 0;
      transition: background 0.15s ease;
    }
    .hex-input {
      font-family: var(--ep-font);
      font-size: 14px;
      font-weight: 600;
      padding: 4px 8px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: var(--bg-soft-color, #f2f3f4);
      color: var(--text-color, #485365);
      width: 78px;
      outline: none;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .hex-input:focus {
      border-color: var(--dark-color, #576273);
      background: var(--bg-color, white);
    }
  `;

  size: number;
  value: string;
  showInput: boolean;
  _hsl: [number, number, number];

  private _dragging: 'wheel' | 'square' | null = null;
  private _wheelWidth = 0;
  private _squareHalf = 0;
  private _mid = 0;
  private _maskDrawn = false;
  private _ready = false;

  private _boundMove: (e: MouseEvent) => void;
  private _boundUp: () => void;

  constructor() {
    super();
    this.size = 200;
    this.value = '#485365';
    this.showInput = true;
    this._hsl = [0, 0, 0.3];
    this._boundMove = this._handleMove.bind(this);
    this._boundUp = this._handleUp.bind(this);
  }

  override connectedCallback() {
    super.connectedCallback();
    this._syncFromValue();
  }

  protected override firstUpdated(_changed: PropertyValues) {
    this._ready = true;
    this._paint();
  }

  protected override updated(changed: PropertyValues) {
    if (!this._ready) return;
    if (changed.has('size')) this._maskDrawn = false;
    if (changed.has('value') && !this._dragging) this._syncFromValue();
    this._paint();
  }

  private _paint() {
    this._computeGeometry();
    if (!this._maskDrawn) { this._drawWheel(); this._maskDrawn = true; }
    this._drawOverlay();
    this._updateSolid();
  }

  protected override render() {
    const s = this.size;
    return html`
      <div class="wrapper">
        <div class="container" style="width:${s}px;height:${s}px;"
             @mousedown="${this._handleDown}">
          <div class="solid"></div>
          <canvas class="mask" width="${s}" height="${s}"></canvas>
          <canvas class="overlay" width="${s}" height="${s}"></canvas>
        </div>
        ${this.showInput ? html`
          <div class="preview-row">
            <div class="swatch-preview" style="background:${this.value}"></div>
            <input class="hex-input"
                   .value="${this.value}"
                   @change="${this._onHexChange}"
                   @keydown="${this._onHexKeydown}"
                   maxlength="7" spellcheck="false"
                   aria-label="Hex color value" />
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Geometry ─────────────────────────────────────────────

  private _computeGeometry() {
    this._mid = this.size / 2;
    this._wheelWidth = Math.round(this.size / 10);
    const innerR = this._mid - this._wheelWidth - 4; // 4px gap
    this._squareHalf = Math.floor(innerR * 0.7);
  }

  // ── Sync ─────────────────────────────────────────────────

  private _syncFromValue() {
    try {
      const [r, g, b] = hexToRgb(this.value);
      this._hsl = rgbToHsl(r, g, b);
    } catch { this._hsl = [0, 0, 0.3]; }
  }

  private _emitColor() {
    const [r, g, b] = hslToRgb(this._hsl[0], this._hsl[1], this._hsl[2]);
    this.value = rgbToHex(r, g, b);
    this.dispatchEvent(new CustomEvent('ep-color-change', {
      bubbles: true, composed: true,
      detail: { color: this.value, hsl: [this._hsl[0], this._hsl[1], this._hsl[2]] },
    }));
  }

  // ── Draw: Hue wheel + sat/lum mask ──────────────────────

  private _drawWheel() {
    const canvas = this.renderRoot?.querySelector<HTMLCanvasElement>('.mask');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = this.size;
    const mid = this._mid;
    const ww = this._wheelWidth;
    const sq = this._squareHalf;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(mid, mid);

    // ── Hue ring (720 segments for smoothness) ──
    const outerR = mid - 1;
    const innerR = outerR - ww;
    const steps = 720;
    for (let i = 0; i < steps; i++) {
      const hue = i / steps;
      const a0 = hue * Math.PI * 2 + ANGLE_OFFSET - 0.01;
      const a1 = (i + 1.5) / steps * Math.PI * 2 + ANGLE_OFFSET;
      const [r, g, b] = hslToRgb(hue, 1, 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, outerR, a0, a1);
      ctx.arc(0, 0, innerR, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = rgbToHex(r, g, b);
      ctx.fill();
    }

    ctx.restore();

    // ── Sat/lum mask (absolute coords — putImageData ignores transform) ──
    const sqSize = sq * 2;
    if (sqSize <= 0) return;
    const imgData = ctx.createImageData(sqSize, sqSize);
    const data = imgData.data;
    for (let y = 0; y < sqSize; y++) {
      const lum = 1 - y / sqSize;
      for (let x = 0; x < sqSize; x++) {
        const sat = 1 - x / sqSize;
        const a = 1 - 2 * Math.min(lum * sat, (1 - lum) * sat);
        const c = a > 0 ? ((2 * lum - 1 + a) * 0.5 / a) : 0;
        const idx = (y * sqSize + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = Math.round(c * 255);
        data[idx + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(imgData, mid - sq, mid - sq);
  }

  // ── Draw: Overlay (markers) ──────────────────────────────

  private _drawOverlay() {
    const canvas = this.renderRoot?.querySelector<HTMLCanvasElement>('.overlay');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = this.size;
    const mid = this._mid;
    const ww = this._wheelWidth;
    const sq = this._squareHalf;
    const [h, s, l] = this._hsl;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(mid, mid);

    const [cr, cg, cb] = hslToRgb(h, s, l);
    const lum = luminance(cr, cg, cb);

    // ── Hue marker on wheel ──
    const hueAngle = h * Math.PI * 2 + ANGLE_OFFSET;
    const wheelMidR = mid - 1 - ww / 2;
    const hx = Math.cos(hueAngle) * wheelMidR;
    const hy = Math.sin(hueAngle) * wheelMidR;
    this._drawRingMarker(ctx, hx, hy, ww / 2 - 1);

    // ── Square marker ──
    const sx = -(s - 0.5) * sq * 2;
    const sy = -(l - 0.5) * sq * 2;
    this._drawDotMarker(ctx, sx, sy, lum > 0.55);

    ctx.restore();
  }

  /** Ring marker for the hue wheel — white ring with shadow */
  private _drawRingMarker(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  /** Dot marker for the square — filled circle with border */
  private _drawDotMarker(ctx: CanvasRenderingContext2D, x: number, y: number, dark: boolean) {
    const r = 7;
    const border = dark ? 'rgba(0,0,0,0.6)' : 'white';
    const inner = dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)';

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.restore();

    // Border ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── Update solid hue div ─────────────────────────────────

  private _updateSolid() {
    const el = this.renderRoot?.querySelector<HTMLElement>('.solid');
    if (!el) return;
    const sq = this._squareHalf;
    const mid = this._mid;
    const [r, g, b] = hslToRgb(this._hsl[0], 1, 0.5);
    el.style.left = `${mid - sq}px`;
    el.style.top = `${mid - sq}px`;
    el.style.width = `${sq * 2}px`;
    el.style.height = `${sq * 2}px`;
    el.style.background = rgbToHex(r, g, b);
  }

  // ── Interaction ──────────────────────────────────────────

  private _handleDown(e: MouseEvent) {
    e.preventDefault();
    const canvas = this.renderRoot?.querySelector<HTMLCanvasElement>('.overlay');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left - this._mid, y: e.clientY - rect.top - this._mid };
    const sq = this._squareHalf;

    // Chebyshev distance: inside square or on the wheel?
    this._dragging = Math.max(Math.abs(pos.x), Math.abs(pos.y)) <= sq + 2 ? 'square' : 'wheel';
    this._applyPos(pos);

    document.addEventListener('mousemove', this._boundMove);
    document.addEventListener('mouseup', this._boundUp);
  }

  private _handleMove(e: MouseEvent) {
    if (!this._dragging) return;
    e.preventDefault();
    const canvas = this.renderRoot?.querySelector<HTMLCanvasElement>('.overlay');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this._applyPos({ x: e.clientX - rect.left - this._mid, y: e.clientY - rect.top - this._mid });
  }

  private _handleUp() {
    this._dragging = null;
    document.removeEventListener('mousemove', this._boundMove);
    document.removeEventListener('mouseup', this._boundUp);
  }

  private _applyPos(pos: { x: number; y: number }) {
    const sq = this._squareHalf;
    const [h, s, l] = this._hsl;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));

    if (this._dragging === 'wheel') {
      // atan2 gives angle from positive X axis; subtract offset to align with our wheel
      const angle = Math.atan2(pos.y, pos.x) - ANGLE_OFFSET;
      this._hsl = [(angle / (Math.PI * 2) + 1) % 1, s, l];
    } else {
      this._hsl = [h, clamp(0.5 - pos.x / (sq * 2)), clamp(0.5 - pos.y / (sq * 2))];
    }
    this._emitColor();
    this.requestUpdate();
  }

  // ── Hex input ────────────────────────────────────────────

  private _onHexChange(e: Event) {
    let val = (e.target as HTMLInputElement).value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
      this.value = val;
      this._syncFromValue();
      this.requestUpdate();
      this.dispatchEvent(new CustomEvent('ep-color-change', {
        bubbles: true, composed: true,
        detail: { color: this.value, hsl: [this._hsl[0], this._hsl[1], this._hsl[2]] },
      }));
    }
  }

  private _onHexKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  }

  // ── Public API ───────────────────────────────────────────

  setHSL(h: number, s: number, l: number) {
    this._hsl = [h, s, l];
    this._emitColor();
    this.requestUpdate();
  }

  getHSL(): [number, number, number] {
    return [this._hsl[0], this._hsl[1], this._hsl[2]];
  }
}

if (!customElements.get('ep-color-wheel')) {
  customElements.define('ep-color-wheel', EpColorWheel);
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-color-wheel': EpColorWheel;
  }
}
