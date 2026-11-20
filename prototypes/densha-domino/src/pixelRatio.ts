// Always author a 2x backing store, including 1x desktop screens enlarged by FIT.
export const PIXEL_RATIO = 2;

/** The design size. Dialogs, the title and result panels are laid out inside this column. */
export const BASE_W = 390;
export const BASE_H = 844;

// Logical canvas size. It starts at the design size and grows in one direction to match the
// screen's shape (wider on foldables, tablets and desktop; taller on tall narrow phones), so the
// canvas fills the screen with no bars. Layout math stays in this logical space; the canvas
// buffer is scaled by PIXEL_RATIO. These are live bindings: read them at use time, not at import.
export let WIDTH = BASE_W;
export let HEIGHT = BASE_H;

/** Logical size for a viewport of `vw` x `vh` CSS pixels. Extreme shapes are clamped (small bars) rather than stretching the layout. */
export function fitLogical(vw: number, vh: number): { w: number; h: number } {
  if (!(vw > 0 && vh > 0)) return { w: BASE_W, h: BASE_H };
  const aspect = Math.min(Math.max(vw / vh, 0.3), 2.4);
  return aspect < BASE_W / BASE_H ? { w: BASE_W, h: Math.round(BASE_W / aspect) } : { w: Math.round(BASE_H * aspect), h: BASE_H };
}

export function setLogicalSize(w: number, h: number): void {
  WIDTH = w;
  HEIGHT = h;
}

/** Positions inside the centred design column, for dialogs and panels authored at 390x844. */
export const colX = (x: number): number => x + (WIDTH - BASE_W) / 2;
export const colY = (y: number): number => y + (HEIGHT - BASE_H) / 2;

/** Where the player was when the screen changed shape, so the rebuilt game can carry on. */
export interface Resume {
  level: number;
  state: number[];
  taps: number;
  longestChain: number;
  title: boolean;
}
let pendingResume: Resume | null = null;
export function setResume(r: Resume | null): void {
  pendingResume = r;
}
export function takeResume(): Resume | null {
  const r = pendingResume;
  pendingResume = null;
  return r;
}
