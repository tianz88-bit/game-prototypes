// Intent layer. Devices (keyboard, pointer/touch) push intents; game logic
// only ever drains intents and never reads a device directly.
//   primary   = Execute (also "fight again" after a result)
//   secondary = Pocket
//   burn      = burn the pocket group at `group` (index into pocket groups)
//   pause     = reserved, not used in combat yet
export type Intent =
  | { type: 'primary' }
  | { type: 'secondary' }
  | { type: 'burn'; group: number }
  | { type: 'pause' };

const queue: Intent[] = [];

export function pushIntent(intent: Intent) {
  queue.push(intent);
}

export function drainIntents(): Intent[] {
  return queue.splice(0, queue.length);
}

export function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') pushIntent({ type: 'primary' });
    else if (e.code === 'KeyK' || e.code === 'KeyP') pushIntent({ type: 'secondary' });
    else if (e.code === 'Escape') pushIntent({ type: 'pause' });
    else if (/^Digit[1-9]$/.test(e.code)) pushIntent({ type: 'burn', group: Number(e.code.slice(5)) - 1 });
    else return;
    e.preventDefault();
  });
}

/**
 * Pointer and touch. `hitTest` maps a logical-space point to an intent
 * (the HUD owns the button layout); this module only forwards events.
 */
export function bindPointer(el: HTMLElement, toLogical: (x: number, y: number) => { x: number; y: number }, hitTest: (x: number, y: number) => Intent | null) {
  el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect();
    const p = toLogical(e.clientX - r.left, e.clientY - r.top);
    const intent = hitTest(p.x, p.y);
    if (intent) pushIntent(intent);
    e.preventDefault();
  });
}
