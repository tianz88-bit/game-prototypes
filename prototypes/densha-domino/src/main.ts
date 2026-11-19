import './fonts/font.css';
import Phaser from 'phaser';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { HEIGHT, PIXEL_RATIO, WIDTH } from './pixelRatio';
import { GameScene } from './scenes/GameScene';

function startGame(): void {
  new Phaser.Game({
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

  mountDebugPanelIfRequested();
}

void document.fonts.load('bold 16px Nunito').then(startGame, startGame);
