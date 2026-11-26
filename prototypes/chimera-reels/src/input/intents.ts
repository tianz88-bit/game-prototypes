// Intent layer. Devices (keyboard, pointer/touch) push intents; game logic
// only ever drains intents and never reads a device directly.
//   primary   = Execute in combat; confirm / continue on other screens
//   secondary = Pocket
//   burn      = burn the pocket group at `group` (index into pocket groups)
//   choose    = pick option `index` (starter, level-up tile)
//   yield     = give up the current fight (asks for a second tap)
//   viewer    = open or close the parts viewer
//   log       = open or close the post-battle combat log
//   pause     = reserved, not used yet
export type Intent =
  | { type: 'primary' }
  | { type: 'secondary' }
  | { type: 'burn'; group: number }
  | { type: 'choose'; index: number }
  | { type: 'yield' }
  | { type: 'viewer' }
  | { type: 'log' }
  | { type: 'pause' };

const queue: Intent[] = [];

export function pushIntent(intent: Intent) {
  queue.push(intent);
}

export function drainIntents(): Intent[] {
  return queue.splice(0, queue.length);
}

export function bindKeyboard(onAny: () => void) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    onAny();
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') pushIntent({ type: 'primary' });
    else if (e.code === 'KeyK' || e.code === 'KeyP') pushIntent({ type: 'secondary' });
    else if (e.code === 'KeyY') pushIntent({ type: 'yield' });
    else if (e.code === 'KeyV') pushIntent({ type: 'viewer' });
    else if (e.code === 'KeyL') pushIntent({ type: 'log' });
    else if (e.code === 'Escape') pushIntent({ type: 'pause' });
    else if (/^Digit[1-9]$/.test(e.code)) {
      const n = Number(e.code.slice(5)) - 1;
      pushIntent({ type: 'burn', group: n });
      pushIntent({ type: 'choose', index: n });
    } else return;
    e.preventDefault();
  });
}

/**
 * Pointer and touch. `hitTest` maps a logical-space point to an intent
 * (the HUD owns the button layout); this module only forwards events.
 */
export function bindPointer(
  el: HTMLElement,
  toLogical: (x: number, y: number) => { x: number; y: number },
  hitTest: (x: number, y: number) => Intent | null,
  onAny: () => void,
) {
  el.addEventListener('pointerdown', (e) => {
    onAny();
    const r = el.getBoundingClientRect();
    const p = toLogical(e.clientX - r.left, e.clientY - r.top);
    const intent = hitTest(p.x, p.y);
    if (intent) pushIntent(intent);
    e.preventDefault();
  });
}
