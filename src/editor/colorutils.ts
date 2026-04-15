export const colorutils = {
  isCssHex(cssColor: string): boolean {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cssColor);
  },

  css2triple(cssColor: string): number[] {
    const sixHex = colorutils.css2sixhex(cssColor);
    const hexToFloat = (hh: string): number => Number(`0x${hh}`) / 255;
    return [hexToFloat(sixHex.substr(0, 2)), hexToFloat(sixHex.substr(2, 2)), hexToFloat(sixHex.substr(4, 2))];
  },

  css2sixhex(cssColor: string): string {
    let h = /[0-9a-fA-F]+/.exec(cssColor)![0];
    if (h.length !== 6) { const a = h.charAt(0); const b = h.charAt(1); const c = h.charAt(2); h = a + a + b + b + c + c; }
    return h;
  },

  triple2css(triple: number[]): string {
    const floatToHex = (n: number): string => { const n2 = colorutils.clamp(Math.round(n * 255), 0, 255); return (`0${n2.toString(16)}`).slice(-2); };
    return `#${floatToHex(triple[0])}${floatToHex(triple[1])}${floatToHex(triple[2])}`;
  },

  clamp(v: number, bot: number, top: number): number {
    return v < bot ? bot : (v > top ? top : v);
  },

  min3(a: number, b: number, c: number): number {
    return (a < b) ? (a < c ? a : c) : (b < c ? b : c);
  },

  max3(a: number, b: number, c: number): number {
    return (a > b) ? (a > c ? a : c) : (b > c ? b : c);
  },

  colorMin(c: number[]): number {
    return colorutils.min3(c[0], c[1], c[2]);
  },

  colorMax(c: number[]): number {
    return colorutils.max3(c[0], c[1], c[2]);
  },

  scale(v: number, bot: number, top: number): number {
    return colorutils.clamp(bot + v * (top - bot), 0, 1);
  },

  unscale(v: number, bot: number, top: number): number {
    return colorutils.clamp((v - bot) / (top - bot), 0, 1);
  },

  scaleColor(c: number[], bot: number, top: number): number[] {
    return [colorutils.scale(c[0], bot, top), colorutils.scale(c[1], bot, top), colorutils.scale(c[2], bot, top)];
  },

  unscaleColor(c: number[], bot: number, top: number): number[] {
    return [colorutils.unscale(c[0], bot, top), colorutils.unscale(c[1], bot, top), colorutils.unscale(c[2], bot, top)];
  },

  luminosity(c: number[]): number {
    return c[0] * 0.30 + c[1] * 0.59 + c[2] * 0.11;
  },

  saturate(c: number[]): number[] {
    const min = colorutils.colorMin(c);
    const max = colorutils.colorMax(c);
    if (max - min <= 0) return [1.0, 1.0, 1.0];
    return colorutils.unscaleColor(c, min, max);
  },

  blend(c1: number[], c2: number[], t: number): number[] {
    return [colorutils.scale(t, c1[0], c2[0]), colorutils.scale(t, c1[1], c2[1]), colorutils.scale(t, c1[2], c2[2])];
  },

  invert(c: number[]): number[] {
    return [1 - c[0], 1 - c[1], 1 - c[2]];
  },

  complementary(c: number[]): number[] {
    const inv = colorutils.invert(c);
    return [
      (inv[0] >= c[0]) ? Math.min(inv[0] * 1.30, 1) : (c[0] * 0.30),
      (inv[1] >= c[1]) ? Math.min(inv[1] * 1.59, 1) : (c[1] * 0.59),
      (inv[2] >= c[2]) ? Math.min(inv[2] * 1.11, 1) : (c[2] * 0.11),
    ];
  },

  textColorFromBackgroundColor(bgcolor: string, _skinName: string): string {
    const white = '#fff';
    const black = '#222';
    return colorutils.luminosity(colorutils.css2triple(bgcolor)) < 0.5 ? white : black;
  },
};
