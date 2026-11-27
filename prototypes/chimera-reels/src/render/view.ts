// Responsive layout. The HUD is designed in a fixed 390 x 844 space (WIDTH x
// HEIGHT) split into three bands: the top panel (enemy), the middle band
// (popups, results, over the arena) and the bottom panel (player). On any
// screen the canvas fills the whole window and the 3D arena fills the canvas;
// the HUD column is scaled to fit, its top band pinned to the top, its bottom
// band pinned to the bottom and its middle band centred in the gap.
//   Tall phones (20:9, 21:9): the extra height goes to the arena.
//   Short or wide screens (16:9, foldable inner screens, landscape): the HUD
//   column is centred and the arena shows around it.
// The pixel buffer is CSS size x a capped devicePixelRatio, so text stays sharp.
export const WIDTH = 390;
export const HEIGHT = 844;
/** Design-space y where the middle band starts and the bottom panel starts. */
export const TOP_END = 186;
export const BOTTOM_START = 474;
const MAX_PIXEL_RATIO = 2;

export interface ViewSize {
  /** Canvas size in CSS pixels (the whole window). */
  cssW: number;
  cssH: number;
  /** CSS pixels per design pixel. */
  scale: number;
  pixelRatio: number;
  /** Left edge of the HUD column, CSS px. */
  offX: number;
  /** CSS px height of the top and bottom HUD bands. */
  topH: number;
  bottomH: number;
  /** CSS px top of the middle HUD band (centred in the gap). */
  midTop: number;
  /** The free band between the panels, where the arena is framed (CSS px). */
  bandTop: number;
  bandBottom: number;
}

export function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

export function fitView(): ViewSize {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const scale = Math.min(cssW / WIDTH, cssH / HEIGHT);
  const topH = TOP_END * scale;
  const bottomH = (HEIGHT - BOTTOM_START) * scale;
  const midH = (BOTTOM_START - TOP_END) * scale;
  const gap = cssH - topH - bottomH;
  return {
    cssW, cssH, scale, pixelRatio: pixelRatio(),
    offX: (cssW - WIDTH * scale) / 2,
    topH, bottomH,
    midTop: topH + (gap - midH) / 2,
    bandTop: topH,
    bandBottom: cssH - bottomH,
  };
}

/** CSS px on the canvas -> design coordinates (for taps). */
export function screenToDesign(v: ViewSize, x: number, y: number): { x: number; y: number } {
  const dx = (x - v.offX) / v.scale;
  if (y < v.topH) return { x: dx, y: y / v.scale };
  if (y >= v.cssH - v.bottomH) return { x: dx, y: BOTTOM_START + (y - (v.cssH - v.bottomH)) / v.scale };
  return { x: dx, y: TOP_END + (y - v.midTop) / v.scale };
}

/** CSS px in the arena -> design coordinates of the middle band (for popups). */
export function arenaToDesign(v: ViewSize, x: number, y: number): { x: number; y: number } {
  return { x: (x - v.offX) / v.scale, y: TOP_END + (y - v.midTop) / v.scale };
}
