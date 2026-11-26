import * as THREE from 'three';
import { Arena } from './render/arena';
import { Hud } from './render/hud';
import { fitView, WIDTH, HEIGHT } from './render/view';
import { bindKeyboard, bindPointer, drainIntents } from './input/intents';
import { createCombat, execute, pocket, burn, pocketGroups, tick, type Combat } from './sim/combat';
import { ENEMY_MONSTER, PLAYER_MONSTER } from './sim/content';
import { makeRng } from './sim/rng';
import { mountDebugPanel } from './debug/panel';

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
let seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
let combat: Combat = newFight();

function newFight(): Combat {
  return createCombat(PLAYER_MONSTER, ENEMY_MONSTER, makeRng(seed++));
}

function restart() {
  combat = newFight();
  arena.reset();
  hud.clearPopups();
}

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

bindKeyboard();
bindPointer(canvas, (x, y) => ({ x: (x / view.cssW) * WIDTH, y: (y / view.cssH) * HEIGHT }), (x, y) => hud.hitTest(x, y, combat));
mountDebugPanel(restart);

function applyIntents() {
  for (const intent of drainIntents()) {
    if (combat.winner) {
      if (intent.type === 'primary') restart();
      continue;
    }
    if (intent.type === 'primary') execute(combat, 'player');
    else if (intent.type === 'secondary') pocket(combat, 'player');
    else if (intent.type === 'burn') {
      const group = pocketGroups(combat.fighters.player)[intent.group];
      if (group) burn(combat, 'player', group.id);
    }
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  applyIntents();
  tick(combat, dt);
  for (const e of combat.events.splice(0)) {
    arena.onEvent(e);
    hud.onEvent(e);
  }
  arena.update(dt);
  hud.update(dt);
  hud.draw(combat);
  renderer.clear();
  renderer.render(arena.scene, arena.camera);
  renderer.render(hud.scene, hud.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for the Playwright check only.
(window as unknown as { __chimera: () => Combat }).__chimera = () => combat;
