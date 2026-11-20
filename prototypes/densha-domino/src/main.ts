import './fonts/font.css';
import Phaser from 'phaser';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { HEIGHT, PIXEL_RATIO, WIDTH, fitLogical, setLogicalSize, setResume } from './pixelRatio';
import { GameScene } from './scenes/GameScene';

const host = document.getElementById('app')!;
let game: Phaser.Game | null = null;

/** Logical size that matches the space the page gives the game, so the canvas fills it. */
function measure(): { w: number; h: number } {
  return fitLogical(host.clientWidth, host.clientHeight);
}

function createGame(): void {
  const size = measure();
  setLogicalSize(size.w, size.h);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#fff0dc',
    fps:{target:60,limit:0},
    render:{antialias:true,pixelArt:false,roundPixels:false},
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WIDTH * PIXEL_RATIO,
      height: HEIGHT * PIXEL_RATIO,
    },
    scene: GameScene,
  });
}

/**
 * When the screen changes shape (fold or unfold, rotate, resize a window), rebuild the game at
 * the new logical size. The level, board and moves carry over. Small changes, such as a mobile
 * address bar sliding away, are left to Phaser's FIT scaling.
 */
let pending = 0;
function onResize(): void {
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    if (!game) return;
    const next = measure();
    const change = Math.max(Math.abs(next.w - WIDTH) / WIDTH, Math.abs(next.h - HEIGHT) / HEIGHT);
    if (change < 0.06) return;
    const scene = game.scene.getScene('game') as GameScene | null;
    setResume(scene && scene.sys.isActive() ? scene.snapshot() : null);
    game.destroy(true);
    game = null;
    createGame();
  }, 200);
}

function startGame(): void {
  createGame();
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  screen.orientation?.addEventListener?.('change', onResize);
  mountDebugPanelIfRequested();
}

void document.fonts.load('bold 16px Nunito').then(startGame, startGame);
