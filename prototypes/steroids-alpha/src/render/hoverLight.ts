import type Phaser from 'phaser';

const KEY = 'human-nomad-ground-hover-light';

/** One shared soft ground pool. A cached texture keeps both WebGL and Canvas inexpensive. */
export function hoverLightTexture(scene: Phaser.Scene, colour: number): string {
  const key = `${KEY}-${colour.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const rgb = `${(colour>>16)&255},${(colour>>8)&255},${colour&255}`;
  const gradient = ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,`rgba(${rgb},0.75)`);
  gradient.addColorStop(.28,`rgba(${rgb},0.55)`);
  gradient.addColorStop(.62,`rgba(${rgb},0.2)`);
  gradient.addColorStop(1,`rgba(${rgb},0)`);
  ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  scene.textures.addCanvas(key,canvas);
  return key;
}
