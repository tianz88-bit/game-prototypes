import Phaser from 'phaser';
import { DEBUG, DPR, refreshDpr } from './base';
import { intents } from './input/intents';
import { BootScene } from './scenes/boot';
import { MenuScene } from './scenes/menu';
import { RotateScene } from './scenes/rotate';
import { FlightScene } from './scenes/flight';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { shipArtStatus } from './render/shipArt';

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
  scene: [BootScene, MenuScene, FlightScene, RotateScene],
});

game.events.once(Phaser.Core.Events.READY, () => {
  intents.attach(game.canvas);
  // Always running, on top of everything: the landscape prompt for phones held upright.
  game.scene.run('rotate');
  game.scene.bringToTop('rotate');
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
      scene: () => (flight() ? 'flight' : game.scene.isActive('boot') ? 'boot' : 'menu'),
      shipArt: () => shipArtStatus,
      scheme: () => intents.scheme,
      portraitBlocked: () => intents.portraitBlocked,
      asteroids: () => flight()?.net.asteroidRender().map((r) => ({ id: r.a.id, size: r.a.size, hp: r.a.hp, x: r.x, y: r.y })) ?? [],
      splits: () => flight()?.net.splits ?? 0,
      bullets: () => flight()?.net.bullets.length ?? 0,
      status: () => flight()?.net.status ?? 'menu',
      zones: () => ({ dash: intents.dashButton, scheme: intents.schemeButton, fire: intents.fireButton }),
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
