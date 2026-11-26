// Portrait viewport fitting and device pixel ratio.
// All layout is done in a fixed logical space (WIDTH x HEIGHT). The canvas
// is fitted into the window keeping that aspect (pillarboxed on wide
// screens, never blocked), and its pixel buffer is sized at CSS size times
// a capped devicePixelRatio so text and thin lines stay sharp on phones.
export const WIDTH = 390;
export const HEIGHT = 844;
const MAX_PIXEL_RATIO = 2;

export interface ViewSize {
  cssW: number;
  cssH: number;
  /** CSS pixels per logical pixel. */
  scale: number;
  pixelRatio: number;
}

export function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

export function fitView(): ViewSize {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const scale = Math.min(ww / WIDTH, wh / HEIGHT);
  return { cssW: Math.floor(WIDTH * scale), cssH: Math.floor(HEIGHT * scale), scale, pixelRatio: pixelRatio() };
}
