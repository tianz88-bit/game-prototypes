// Loads the ship art, then goes to the menu (or straight to a planet with ?planet=).
import Phaser from 'phaser';
import { URL_PLANET, logicalSize } from '../base';
import { isPlanetId } from '../../sim/planets';
import { prepareShipArt, queueShipArt } from '../render/shipArt';
import { fitCamera, text, versionStamp } from './common';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    fitCamera(this);
    const { w, h } = logicalSize();
    const label = text(this, w / 2, h / 2, 'Loading ships…', 16, '#8fa2c8').setOrigin(0.5);
    versionStamp(this);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => label.setText(`Loading ships… ${Math.round(p * 100)}%`));
    // A missing part is not fatal: prepareShipArt() falls back to placeholder shapes.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => console.warn('Ship art failed to load:', file.key));
    queueShipArt(this);
  }

  create(): void {
    prepareShipArt(this);
    if (isPlanetId(URL_PLANET)) this.scene.start('flight', { planet: URL_PLANET });
    else this.scene.start('menu');
  }
}
