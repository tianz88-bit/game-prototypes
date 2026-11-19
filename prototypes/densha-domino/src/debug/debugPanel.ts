import { mountTunePanelIfRequested } from 'dig-kit';
import { SAVE_KEY } from '../scenes/GameScene';
import { runtime } from '../scenes/GameScene';
import { tune, tuneDefaults } from '../tune';
import {LEVELS} from '../game/levels';

export function mountDebugPanelIfRequested(): void {
  mountTunePanelIfRequested({
    title: 'densha domino tune',
    tune,
    defaults: tuneDefaults,
    extras: (pane) => {
      pane.addBinding(tune.feel,'uiEase',{options:{Quad:'Quad.Out',Cubic:'Cubic.Out',Sine:'Sine.Out'}});
      pane.addBinding(runtime,'fps',{readonly:true,label:'render fps'});
      pane.addBinding(runtime, 'goto', { min: 1, max: LEVELS.length, step: 1, label: 'level' });
      pane.addButton({ title: 'Go to level' }).on('click', () => {
        runtime.apply = true;
      });
      pane.addButton({ title: 'Reset save and reload' }).on('click', () => {
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch {
          /* storage unavailable */
        }
        location.reload();
      });
    },
  });
}
