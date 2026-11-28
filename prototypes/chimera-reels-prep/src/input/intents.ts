// Intent layer. Devices (keyboard, pointer/touch) push intents; game logic
// only ever drains intents and never reads a device directly.
//   primary   = Fight (lock in the plan); confirm / continue on other screens
//   secondary = re-spin (costs gold)
//   row       = queue or unqueue a grid row
//   nudge     = shift a reel by one row (dir 1 = tiles move down, -1 = up)
//   burn      = burn the pocket group at `group` (index into pocket groups)
//   choose    = pick option `index` (starter, level-up tile)
//   yield     = give up the current fight (asks for a second tap)
//   viewer    = open or close the parts viewer
//   fullscreen = toggle fullscreen (title screen)
//   log       = open or close the post-battle combat log
//   pause     = reserved, not used yet
export type Intent =
  | { type: 'primary' }
  | { type: 'secondary' }
  | { type: 'burn'; group: number }
  | { type: 'row'; row: number }
  | { type: 'nudge'; reel: 0 | 1 | 2; dir: 1 | -1 }
  | { type: 'choose'; index: number }
  | { type: 'yield' }
  | { type: 'viewer' }
  | { type: 'fullscreen' }
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
    else if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') pushIntent({ type: 'row', row: 'ZXC'.indexOf(e.code[3]) });
    else if (e.code === 'KeyQ' || e.code === 'KeyW' || e.code === 'KeyE') pushIntent({ type: 'nudge', reel: 'QWE'.indexOf(e.code[3]) as 0 | 1 | 2, dir: 1 });
    else if (e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') pushIntent({ type: 'nudge', reel: 'ASD'.indexOf(e.code[3]) as 0 | 1 | 2, dir: -1 });
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
  onAny: (e: PointerEvent) => void,
) {
  el.addEventListener('pointerdown', (e) => {
    onAny(e);
    const r = el.getBoundingClientRect();
    const p = toLogical(e.clientX - r.left, e.clientY - r.top);
    const intent = hitTest(p.x, p.y);
    if (intent) pushIntent(intent);
    e.preventDefault();
  });
}
