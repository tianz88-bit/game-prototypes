import Phaser from 'phaser';
import { DEBUG, DPR, logicalSize, placeContainer, refreshDpr, refreshSideways, sideways } from './base';
import { intents } from './input/intents';
import { BootScene } from './scenes/boot';
import { MenuScene } from './scenes/menu';
import { FlightScene } from './scenes/flight';
import { HangarScene } from './scenes/hangar';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { shipArtStatus } from './render/shipArt';
import { rockCoverage } from './render/rockPainted';
import { TUNE } from '../sim/tune';
import { topSpeed } from '../sim/ship';

// The pixel buffer is logical size x DPR; Scale zoom of 1/DPR shows it at CSS size,
// and every scene's camera zoom of DPR maps logical coordinates back onto it.
const app = document.getElementById('app') as HTMLElement;
placeContainer(app);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: Math.round(logicalSize().w * DPR),
  height: Math.round(logicalSize().h * DPR),
  backgroundColor: '#05070d',
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  // Phaser input is off: all input goes through the intent layer.
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, MenuScene, FlightScene, HangarScene],
});

game.events.once(Phaser.Core.Events.READY, () => {
  intents.attach(game.canvas);
});

function fit(): void {
  const dprChanged = refreshDpr();
  if (dprChanged) game.scale.setZoom(1 / DPR);
  refreshSideways();
  placeContainer(app);
  const { w, h } = logicalSize();
  game.scale.resize(Math.round(w * DPR), Math.round(h * DPR));
  game.events.emit('dpr');
}
window.addEventListener('resize', fit);
// A text field closing ends the hold on the quarter turn (base.refreshSideways).
window.addEventListener('focusout', () => setTimeout(fit, 0));
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
      light: () => flight()?.lighting() ?? null,
      roster: () => [...(flight()?.net.roster.values() ?? [])],
      board: () => flight()?.boardOrder() ?? [],
      /** Debug only: bump a player's kills on this client, to review the leaderboard animation. */
      fakeKill: (id: number) => {
        const r = flight()?.net.roster.get(id);
        if (r) r.kills++;
      },
      death: () => flight()?.net.death ?? null,
      deathButtons: () => flight()?.deathButtonZones() ?? [],
      explosions: () => flight()?.explosionCount() ?? 0,
      pickups: () => flight()?.net.pickups.size ?? 0,
      pickupList: () => [...(flight()?.net.pickups.values() ?? [])],
      shieldHits: () => flight()?.shieldHitCount ?? 0,
      rams: () => flight()?.ramCount ?? 0,
      dashChargeFrames: () => flight()?.dashChargeFrames ?? 0,
      /** Debug only: an explosion at your ship, to review the effect. */
      boom: () => flight()?.debugExplosion(),
      /** Debug only: a blocked hit on your ship, to review the shield effect. */
      shieldHit: (angle?: number) => flight()?.debugShieldHit(angle),
      nameBox: () => (game.scene.getScene('menu') as MenuScene).nameBox,
      menuCredits: () => (game.scene.getScene('menu') as MenuScene).credits,
      hangarButton: () => (game.scene.getScene('menu') as MenuScene).hangarButton,
      hangar: () => { const h = game.scene.getScene('hangar') as HangarScene; return game.scene.isActive('hangar') ? { credits: h.credits, unlocks: h.unlocks, cards: h.cards.map((c) => ({ id: c.u.id, x: c.x, y: c.y })), tabs: h.tabs, back: h.backButton } : null; },
      accountButton: () => (game.scene.getScene('menu') as MenuScene).accountButton,
      sideways: () => sideways(),
      asteroids: () => flight()?.net.asteroidRender().map((r) => ({ id: r.a.id, size: r.a.size, hp: r.a.hp, x: r.x, y: r.y })) ?? [],
      splits: () => flight()?.net.splits ?? 0,
      ordnance: () => [...(flight()?.net.ordnance.values() ?? [])],
      /** Debug only: the flight scene itself, for render checks that stage state. */
      flightScene: () => flight(),
      rockCoverage: () => rockCoverage(),
      weaponButtons: () => ({ missile: intents.missileButton, mine: intents.mineButton }),
      warpButton: () => intents.warpButton,
      bullets: () => flight()?.net.bullets.length ?? 0,
      status: () => flight()?.net.status ?? 'menu',
      zones: () => ({ dash: intents.dashButton, scheme: intents.schemeButton, fire: intents.fireButton }),
      menuButtons: () => (game.scene.getScene('menu') as MenuScene).buttons,
      menuCounts: () => (game.scene.getScene('menu') as MenuScene).countLabels(),
      shareBox: () => (game.scene.getScene('menu') as MenuScene).shareBox,
      own: () => flight()?.net.ownRender() ?? null,
      /** Your ship's top speed now (power lowers it). */
      topSpeed: () => { const o = flight()?.net.predicted; return o ? topSpeed(o.hullMax, TUNE, o.chassis) : 0; },
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
