import Phaser from 'phaser';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { HEIGHT, PIXEL_RATIO, WIDTH } from './pixelRatio';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0d0a14',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH * PIXEL_RATIO,
    height: HEIGHT * PIXEL_RATIO,
  },
  scene: GameScene,
});

mountDebugPanelIfRequested();
