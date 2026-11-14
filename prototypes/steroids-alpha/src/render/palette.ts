// Ship palettes (owner art): a TypeScript port of tools/ship-rig/human-nomad-ships-v2/palette-remap.mjs.
// Repaints the cobalt hull (primary), orange trim (accent) and cyan glass/lights (glow) of the original
// part pixels by hue band, keeping each pixel's shading; outlines, cream and alpha are untouched.
// Applied to the part textures before the game's depth and night shading. Never a whole-hull tint.
import config from '../../art/ships-v2/palettes.json';

export const PALETTES = config.palettes;

function hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const v = Math.max(r, g, b);
  const n = Math.min(r, g, b);
  const d = v - n;
  let h = 0;
  if (d) {
    h = v === r ? (g - b) / d + (g < b ? 6 : 0) : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, v ? d / v : 0, v];
}

function rgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const out = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [Math.round(out[0] * 255), Math.round(out[1] * 255), Math.round(out[2] * 255)];
}

/** Remap RGBA pixels in place to palette index (0 is the original art: unchanged). */
export function remapPixels(px: Uint8ClampedArray, index: number): void {
  if (index <= 0 || index >= PALETTES.length) return;
  const target = (hex: string): [number, number, number] => hsv(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  const p = PALETTES[index];
  const t = { primary: target(p.primary), accent: target(p.accent), glow: target(p.glow) };
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const [h, s, v] = hsv(px[i], px[i + 1], px[i + 2]);
    const k = h > 0.42 && h < 0.59 && s > 0.3 && v > 0.4 ? 'glow' : h > 0.54 && h < 0.7 && s > 0.55 && v > 0.32 ? 'primary' : h > 0.015 && h < 0.16 && s > 0.55 && v > 0.4 ? 'accent' : null;
    if (!k) continue;
    const [hh, ss, vv] = t[k];
    const c = rgb(hh, Math.min(1, s * ss), Math.min(1, (v * vv) / (k === 'primary' ? 0.949 : 1)));
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  }
}
