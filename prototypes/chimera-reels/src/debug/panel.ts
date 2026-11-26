// Tweakpane panel for tune.json, shown only with ?debug=1 (production too).
// Same behaviour as dig-kit's tunePanel; kept local because dig-kit's barrel
// export pulls in Phaser-dependent modules and this prototype has no Phaser.
import { Pane } from 'tweakpane';
import defaults from '../../tune.json';
import { tune } from '../tune';

type Bag = Record<string, unknown>;

function rangeFor(def: number): { min: number; max: number; step: number } {
  const isInt = Number.isInteger(def);
  const max = def === 0 ? 10 : Math.abs(def) * 4;
  return { min: def < 0 ? -max : 0, max: isInt ? Math.max(10, max) : Math.max(1, max), step: isInt ? 1 : 0.01 };
}

interface Container {
  addBinding: (obj: Bag, key: string, opts: object) => unknown;
  addFolder: (opts: { title: string; expanded: boolean }) => Container;
}

function addGroup(parent: Container, obj: Bag, defs: Bag) {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'number') parent.addBinding(obj, key, { ...rangeFor(defs[key] as number), label: key });
    else if (v && typeof v === 'object') addGroup(parent.addFolder({ title: key, expanded: false }), v as Bag, defs[key] as Bag);
  }
}

export function mountDebugPanel(onRestart: () => void) {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;
  const pane = new Pane({ title: 'Chimera Reels tune' });
  pane.addButton({ title: 'Restart fight' }).on('click', onRestart);
  pane.addButton({ title: 'Copy JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(tune, null, 2));
  });
  addGroup(pane as unknown as Container, tune as unknown as Bag, defaults as unknown as Bag);
}
