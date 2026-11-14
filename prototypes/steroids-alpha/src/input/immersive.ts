// Fullscreen on Play (owner decision, 14 November 2026). On a touch device, choosing a planet asks
// for fullscreen and, on a tall phone, a landscape lock, the closest a web page gets to a native
// landscape game. Android Chrome allows both; iPad allows fullscreen only; iPhone Safari allows
// neither, so there the sideways render (base.sideways) does the work. Any refusal is ignored:
// the game plays the same either way and nothing waits on it.
interface FullscreenDoc { fullscreenElement?: Element | null; webkitFullscreenElement?: Element | null }
interface FullscreenEl { requestFullscreen?: (o?: FullscreenOptions) => Promise<void>; webkitRequestFullscreen?: () => void }
interface LockableOrientation { lock?: (o: string) => Promise<void> }

export function goImmersive(touch: boolean): void {
  if (!touch) return;
  const doc = document as unknown as FullscreenDoc;
  const el = document.documentElement as unknown as FullscreenEl;
  const lock = (): void => {
    // Lock only tall phones; a near-square screen (open foldable, tablet) plays either way round.
    const long = Math.max(screen.width, screen.height) / Math.max(1, Math.min(screen.width, screen.height));
    if (long < 1.4) return;
    (screen.orientation as unknown as LockableOrientation | undefined)?.lock?.('landscape')?.catch(() => {});
  };
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement) return lock();
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    // Not allowed here (iPhone, or an embed without fullscreen permission): play as is.
  }
}
