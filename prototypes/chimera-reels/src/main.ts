import * as THREE from 'three';
import { Arena } from './render/arena';
import { Hud } from './render/hud';
import { fitView, WIDTH, HEIGHT } from './render/view';
import { bindKeyboard, bindPointer, drainIntents, type Intent } from './input/intents';
import { burn, execute, pocket, pocketGroups, tick } from './sim/combat';
import { SLOTS, STARTERS } from './sim/content';
import { makeRng } from './sim/rng';
import {
  chooseLoot, chooseOffer, chooseStarter, continueAfterResult, enterFight, entryBet, rerollRandomStarter, starterOptions, finishFight, newRun, playerYield, restartRun, type Run,
} from './sim/run';
import { mountDebugPanel } from './debug/panel';
import { sfx, unlockAudio } from './audio/sfx';
import { tune } from './tune';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
const canvas = renderer.domElement;
canvas.style.display = 'block';
canvas.style.margin = '0 auto';
canvas.style.touchAction = 'none';

const arena = new Arena();
const hud = new Hud();
hud.setHeadLocator((side) => arena.headScreen(side));

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
let run: Run = newRun(makeRng(seed));
/** Seconds the KO / yield is shown before the result screen. */
let endDelay = 0;
/** Hit-stop: sim and 3D freeze briefly on big impacts. */
let hitStop = 0;

let view = fitView();
function resize() {
  view = fitView();
  renderer.setPixelRatio(view.pixelRatio);
  renderer.setSize(view.cssW, view.cssH);
  canvas.style.marginTop = `${Math.floor((window.innerHeight - view.cssH) / 2)}px`;
  hud.resize(view);
}
window.addEventListener('resize', resize);
resize();

bindKeyboard(unlockAudio);
bindPointer(canvas, (x, y) => ({ x: (x / view.cssW) * WIDTH, y: (y / view.cssH) * HEIGHT }), (x, y) => hud.hitTest(x, y, run), unlockAudio);
// Debug "Restart fight": refund the bet and start the same floor again.
mountDebugPanel(() => {
  if (run.screen !== 'fight') return;
  run.gold += entryBet(run);
  run.screen = 'prefight';
  startFight();
});

function startFight() {
  enterFight(run);
  arena.resetFight();
  hud.resetFight();
  endDelay = 0;
}

const viewerScreens = ['select', 'prefight', 'loot', 'levelup'];

function applyIntent(intent: Intent) {
  const c = run.combat;
  if (intent.type === 'viewer' && viewerScreens.includes(run.screen)) {
    hud.viewerOpen = !hud.viewerOpen;
    hud.pressed('parts');
    sfx.ui();
    return;
  }
  if (intent.type === 'log' && hud.logAvailable(run)) {
    hud.logOpen = !hud.logOpen;
    hud.logPage = 0;
    sfx.ui();
    return;
  }
  if (hud.logOpen) {
    if (intent.type === 'choose' && run.combat) {
      const pages = hud.logPages(run.combat);
      hud.logPage = Math.max(0, Math.min(pages - 1, hud.logPage + (intent.index === 0 ? -1 : 1)));
      sfx.ui();
    }
    return;
  }
  if (hud.viewerOpen) {
    if (intent.type === 'choose' && intent.index <= SLOTS.length) {
      hud.viewerSlot = intent.index;
      sfx.ui();
    }
    return;
  }
  switch (run.screen) {
    case 'select':
      if (intent.type === 'choose' && intent.index < starterOptions(run).length) {
        // Tapping the selected random card again re-rolls it.
        if (intent.index === STARTERS.length && hud.selectIndex === intent.index) rerollRandomStarter(run);
        hud.selectIndex = intent.index;
        sfx.ui();
      } else if (intent.type === 'primary') {
        hud.pressed('wide');
        sfx.ui();
        chooseStarter(run, hud.selectIndex);
      }
      break;
    case 'prefight':
      if (intent.type === 'primary') {
        hud.pressed('wide');
        sfx.coin();
        startFight();
      }
      break;
    case 'fight':
      if (!c || c.winner) break;
      if (intent.type === 'primary') {
        if (execute(c, 'player')) hud.pressed('execute');
      } else if (intent.type === 'secondary') {
        if (pocket(c, 'player')) hud.pressed('pocket');
      } else if (intent.type === 'burn') {
        const group = pocketGroups(c.fighters.player)[intent.group];
        if (group) burn(c, 'player', group.id);
      } else if (intent.type === 'yield') {
        if (hud.armYield()) playerYield(run);
      }
      break;
    case 'result':
      if (intent.type === 'primary') {
        hud.pressed('wide');
        sfx.ui();
        continueAfterResult(run);
      }
      break;
    case 'loot':
      if (intent.type === 'choose' && intent.index < 2) {
        sfx.ui();
        chooseLoot(run, intent.index === 0);
      }
      break;
    case 'levelup':
      if (intent.type === 'choose' && intent.index < run.offers.length) {
        sfx.match(2);
        chooseOffer(run, intent.index);
      }
      break;
    case 'gameover':
      if (intent.type === 'primary') {
        hud.pressed('wide');
        sfx.ui();
        run = restartRun(run);
      }
      break;
  }
}

function syncArena() {
  if (!viewerScreens.includes(run.screen)) hud.viewerOpen = false;
  if (!hud.logAvailable(run)) hud.logOpen = false;
  arena.viewer = hud.viewerOpen ? { slot: SLOTS[hud.viewerSlot] ?? null } : null;
  if (run.screen === 'select') arena.setMonsters(starterOptions(run)[hud.selectIndex], null);
  else if (run.screen === 'gameover') arena.setMonsters(null, run.enemy);
  else arena.setMonsters(run.monster, run.enemy);
}

let last = performance.now();
function frame(now: number) {
  const rawDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const intent of drainIntents()) applyIntent(intent);
  syncArena();

  const c = run.combat;
  let simDt = rawDt;
  if (hitStop > 0) {
    hitStop = Math.max(0, hitStop - rawDt);
    simDt = 0;
  }
  if (run.screen === 'fight' && c) {
    tick(c, simDt);
    for (const e of c.events.splice(0)) {
      arena.onEvent(e, c);
      hud.onEvent(e, c);
      const f = tune.feel;
      if (e.type === 'action' && e.isSuper) hitStop = Math.max(hitStop, f.superHitStopSec);
      if (e.type === 'hit') hitStop = Math.max(hitStop, e.amount >= f.bigHit ? f.bigHitStopSec : f.hitStopSec);
      if (e.type === 'break') hitStop = Math.max(hitStop, f.bigHitStopSec);
    }
    if (c.winner) {
      endDelay += rawDt;
      if (endDelay > 1.3) {
        finishFight(run);
        if (run.last?.won) hud.payout(run.last.payout);
      }
    }
  }
  arena.update(simDt, run.screen === 'fight' || run.screen === 'result' ? c : null);
  hud.update(rawDt, run);
  hud.draw(run);
  renderer.clear();
  renderer.render(arena.scene, arena.camera);
  renderer.render(hud.scene, hud.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for the Playwright check only.
(window as unknown as { __chimera: () => Run }).__chimera = () => run;
