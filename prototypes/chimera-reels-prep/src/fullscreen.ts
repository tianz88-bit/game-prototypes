// Fullscreen on phones. Browsers only allow it from a user gesture, so the
// first tap on a touch device asks for it once; a toggle on the title screen
// enters or leaves it on any device. iPhone Safari has no fullscreen API for
// pages: there, "Add to Home Screen" launches full screen via the meta tags
// and manifest in index.html. Any failure is ignored and play continues.

let autoTried = false;

const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };

export function fullscreenSupported(): boolean {
  return !!(root.requestFullscreen || root.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  return !!(document.fullscreenElement || doc.webkitFullscreenElement);
}

function enter() {
  try {
    if (root.requestFullscreen) {
      root.requestFullscreen({ navigationUI: 'hide' }).then(lockPortrait).catch(() => undefined);
    } else root.webkitRequestFullscreen?.();
  } catch {
    // Not allowed here: keep playing in the browser window.
  }
}

function lockPortrait() {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('portrait').catch(() => undefined);
}

export function toggleFullscreen() {
  if (isFullscreen()) {
    try {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => undefined);
      else doc.webkitExitFullscreen?.();
    } catch {
      // ignore
    }
  } else enter();
}

/** Called on every tap: the first one on a touch device goes fullscreen. */
export function autoFullscreen(e: PointerEvent | KeyboardEvent) {
  if (autoTried || !fullscreenSupported()) return;
  const touch = 'pointerType' in e ? e.pointerType === 'touch' : false;
  if (!touch) return;
  autoTried = true;
  if (!isFullscreen()) enter();
}
