import { Pane } from 'tweakpane';
import { TUNE } from '../../sim/tune';
import { clientTune } from '../clientTune';
import { DEBUG } from '../base';

type Obj = Record<string, unknown>;
interface Folder {
  addBinding(o: Obj, k: string, opts?: Obj): unknown;
  addFolder(p: { title: string; expanded: boolean }): Folder;
}

/**
 * Tweakpane over every tune value, in production builds via ?debug=1.
 * client.tune.json values edit live. tune.json values are the game rules the server
 * enforces, so they are shown read-only here: editing them locally would only
 * break prediction. Change them in tune.json, which both sides bundle.
 */
export function mountDebugPanelIfRequested(stats: () => Obj): void {
  if (!DEBUG) return;
  const pane = new Pane({ title: 'steroids-alpha tune', expanded: false });
  pane.addButton({ title: 'Copy client.tune.json' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(clientTune, null, 2) + '\n');
  });
  pane.addButton({ title: 'Copy tune.json' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(TUNE, null, 2) + '\n');
  });
  const root = pane as unknown as Folder;
  const addAll = (folder: Folder, values: Obj, readonly: boolean): void => {
    for (const key of Object.keys(values)) {
      const v = values[key];
      if (typeof v === 'object' && v !== null) addAll(folder.addFolder({ title: key, expanded: false }), v as Obj, readonly);
      else folder.addBinding(values, key, readonly ? { readonly: true } : undefined);
    }
  };
  addAll(root.addFolder({ title: 'client (live)', expanded: false }), clientTune as unknown as Obj, false);
  addAll(root.addFolder({ title: 'rules (tune.json, read-only)', expanded: false }), structuredClone(TUNE) as unknown as Obj, true);

  const live: Obj = {};
  const statsFolder = root.addFolder({ title: 'net stats', expanded: true });
  Object.assign(live, stats());
  for (const key of Object.keys(live)) statsFolder.addBinding(live, key, { readonly: true });
  setInterval(() => Object.assign(live, stats()), 250);
}
