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

/** Logical (CSS pixel) size every scene lays out in. */
export function logicalSize(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight };
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
