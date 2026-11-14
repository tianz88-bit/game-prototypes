import { clientTune } from './clientTune';

const params = new URLSearchParams(location.search);
export const DEBUG = params.get('debug') === '1';

/** Backing-store scale: the game buffer is logical size times this, undone by camera zoom. */
export let DPR = Math.min(window.devicePixelRatio || 1, clientTune.dpr.max);

/** Re-read devicePixelRatio (browser zoom, another monitor). Returns true if it changed. */
export function refreshDpr(): boolean {
  const next = Math.min(window.devicePixelRatio || 1, clientTune.dpr.max);
  if (Math.abs(next - DPR) < 1e-6) return false;
  DPR = next;
  return true;
}

/**
 * Phones held upright (owner decision, 14 November 2026: never block the player). Instead of a
 * "turn your phone" screen, the landscape game is drawn turned a quarter (its top along the
 * screen's left edge), as native landscape games show when held upright: the player turns the
 * phone, or plays it sideways. Only clearly tall screens turn; near-square ones (open foldables,
 * tablets) play as they are.
 */
const SIDEWAYS_ASPECT = 1.4;
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let sidewaysNow = false;

/** True while the game is drawn turned a quarter (see SIDEWAYS_ASPECT). */
export const sideways = (): boolean => sidewaysNow;

/**
 * Re-decide the turn from the window size. Held while a text field is focused: a phone keyboard
 * shrinks the window, and the game must not flip under the player while they type.
 */
export function refreshSideways(): void {
  if (document.activeElement instanceof HTMLInputElement) return;
  sidewaysNow = coarse && window.innerHeight > window.innerWidth * SIDEWAYS_ASPECT;
}
refreshSideways();

/** Logical (CSS pixel) size every scene lays out in (landscape when drawn sideways). */
export function logicalSize(): { w: number; h: number } {
  return sidewaysNow ? { w: window.innerHeight, h: window.innerWidth } : { w: window.innerWidth, h: window.innerHeight };
}

/** A pointer's window position in logical coordinates (undoes the quarter turn). */
export function toLogical(cx: number, cy: number): { x: number; y: number } {
  return sidewaysNow ? { x: window.innerHeight - cy, y: cx } : { x: cx, y: cy };
}

/**
 * Lays out the game's container: full window, or turned a quarter anticlockwise so the
 * landscape game's top runs along the screen's left edge.
 */
export function placeContainer(el: HTMLElement): void {
  const { w, h } = logicalSize();
  Object.assign(el.style, sidewaysNow
    ? { inset: 'auto', left: '0px', top: '0px', width: `${w}px`, height: `${h}px`, transformOrigin: '0 0', transform: `translateY(${w}px) rotate(-90deg)` }
    : { inset: '0px', left: '', top: '', width: '', height: '', transformOrigin: '', transform: '' });
}

/** Server WebSocket origin: ?server=... override, else the build-time value, else the same host on port 8787 (wrangler dev). */
export function serverOrigin(): string {
  const override = params.get('server');
  if (override) return override;
  const built = import.meta.env.VITE_STEROIDS_SERVER as string | undefined;
  if (built) return built;
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.hostname || '127.0.0.1'}:8787`;
}

/** Debug only: artificial one-way delay in ms added to each direction, to feel real ping locally. */
export const SIM_LAG_MS = DEBUG ? Math.max(0, Number(params.get('lag') ?? 0) / 2) : 0;

/** Debug only: ?rot=<degrees> freezes the planet's turn at that angle, to inspect day and night. */
export const DEBUG_ROTATION = DEBUG && params.get('rot') !== null ? Number(params.get('rot')) : null;

/** Planet given in the URL, which skips the menu. */
export const URL_PLANET = params.get('planet');

/**
 * The game's public page, for the menu's share QR code and copy link. Inside itch the game runs in a
 * frame on itch's file server, so location.href would not be a link people can open (owner decision).
 */
export const SHARE_URL = 'https://daily-daily-games.itch.io/steroids-alpha';
