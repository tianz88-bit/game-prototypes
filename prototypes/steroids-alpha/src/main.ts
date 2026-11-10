import Phaser from 'phaser';
import { DEBUG, DPR, URL_PLANET, refreshDpr } from './base';
import { intents } from './input/intents';
import { MenuScene } from './scenes/menu';
import { FlightScene } from './scenes/flight';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { isPlanetId } from '../sim/planets';

// The pixel buffer is logical size x DPR; Scale zoom of 1/DPR shows it at CSS size,
// and every scene's camera zoom of DPR maps logical coordinates back onto it.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: Math.round(window.innerWidth * DPR),
  height: Math.round(window.innerHeight * DPR),
  backgroundColor: '#05070d',
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  // Phaser input is off: all input goes through the intent layer.
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  render: { antialias: true, roundPixels: false },
  scene: [MenuScene, FlightScene],
});

game.events.once(Phaser.Core.Events.READY, () => {
  intents.attach(game.canvas);
  // ?planet=alpha drops straight in (handy for testing).
  if (isPlanetId(URL_PLANET)) {
    game.scene.stop('menu');
    game.scene.start('flight', { planet: URL_PLANET });
  }
});

function fit(): void {
  const dprChanged = refreshDpr();
  if (dprChanged) game.scale.setZoom(1 / DPR);
  game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
  game.events.emit('dpr');
}
window.addEventListener('resize', fit);
function watchDpr(): void {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
    'change',
    () => {
      fit();
      watchDpr();
    },
    { once: true },
  );
}
watchDpr();

function flight(): FlightScene | null {
  const s = game.scene.getScene('flight') as FlightScene | null;
  return s && game.scene.isActive('flight') ? s : null;
}

function stats(): Record<string, unknown> {
  const n = flight()?.net;
  return {
    status: n?.status ?? 'menu',
    rttMs: Math.round(n?.rttMs ?? 0),
    pending: n?.pendingCount ?? 0,
    correction: Number((n?.lastCorrection ?? 0).toFixed(2)),
    remotes: n?.remoteCount ?? 0,
    snapshots: n?.snapshots ?? 0,
    kBytesIn: Number(((n?.bytesIn ?? 0) / 1024).toFixed(1)),
    inputSeq: n?.inputSeq ?? 0,
    lastAck: n?.lastAck ?? 0,
    serverTick: n?.serverTick ?? 0,
  };
}

mountDebugPanelIfRequested(stats);

// Handle for the Playwright check (debug builds only).
if (DEBUG) {
  Object.assign(window, {
    __steroids: {
      stats,
      scene: () => (flight() ? 'flight' : 'menu'),
      menuButtons: () => (game.scene.getScene('menu') as MenuScene).buttons,
      own: () => flight()?.net.ownRender() ?? null,
      corrections: () => ({ ...(flight()?.net.corrections ?? { snapshots: 0, count: 0, max: 0 }) }),
      resetCorrections: () => {
        const n = flight()?.net;
        if (n) n.corrections = { snapshots: 0, count: 0, max: 0 };
      },
      myId: () => flight()?.net.myId ?? 0,
      remotes: () => flight()?.net.remoteRender() ?? [],
    },
  });
}
