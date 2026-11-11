// Loads the approved Human Nomad parts and prepares one runtime texture per part.
// Registration follows the kit's trimFrame(): alpha bounds (alpha > 12) of the untouched source PNG.
// The trimmed region is then resampled once to at most render.partTextureMax px on its long side,
// as the kit's own renderer does (256 px), because parts draw at a small fraction of source size.
// Source files are never modified. If any part fails to load, ships fall back to placeholder shapes.
import Phaser from 'phaser';
import calibrationJson from '../../art/human-nomad-v1/calibration-approved.json';
import { ASSETS, MODULES, checkCalibration } from './shipRig';
import type { Calibration } from './shipRig';
import { clientTune } from '../clientTune';

export const SHIP_ID = 'human-nomad-v1';
export const CALIBRATION: Calibration = checkCalibration(calibrationJson);
export const SHADOW_ANCHOR = {...calibrationJson.shadow};

export type ShipArtStatus = 'loading' | 'ready' | 'placeholder';
export let shipArtStatus: ShipArtStatus = 'loading';

const sourceKey = (asset: string): string => `${SHIP_ID}-src-${asset}`;
/** Runtime texture key for a part. */
export const partKey = (asset: string): string => `${SHIP_ID}-${asset}`;
export const SHADOW_KEY = `${SHIP_ID}-shadow`;

export function queueShipArt(scene: Phaser.Scene): void {
  for (const a of ASSETS) scene.load.image(sourceKey(a), `assets/loose/${SHIP_ID}-${a}.png`);
}

/** Call in create() after the loader finished. Returns the resulting status. */
export function prepareShipArt(scene: Phaser.Scene): ShipArtStatus {
  try {
    for (const a of ASSETS) {
      if (!scene.textures.exists(sourceKey(a))) throw new Error(`missing ${a}`);
    }
    for (const a of ASSETS) {
      const src = scene.textures.get(sourceKey(a)).getSourceImage() as HTMLImageElement;
      const box = alphaBounds(src);
      const max = clientTune.render.partTextureMax;
      const k = Math.min(1, max / Math.max(box.w, box.h));
      const canvas = resample(src, box, Math.max(1, Math.round(box.w * k)), Math.max(1, Math.round(box.h * k)));
      scene.textures.addCanvas(partKey(a), canvas);
      scene.textures.remove(sourceKey(a)); // free the full-size source
    }
    buildShadow(scene);
    shipArtStatus = 'ready';
  } catch (e) {
    console.warn('Ship art unavailable, using placeholder shapes:', (e as Error).message);
    shipArtStatus = 'placeholder';
  }
  return shipArtStatus;
}

function alphaBounds(img: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let left = c.width;
  let top = c.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 12) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right <= left || bottom <= top) throw new Error('empty part texture');
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/** Halve repeatedly, then a final resize: a large one-step downscale aliases. */
function resample(img: HTMLImageElement, box: { x: number; y: number; w: number; h: number }, w: number, h: number): HTMLCanvasElement {
  let cur: HTMLCanvasElement = document.createElement('canvas');
  cur.width = box.w;
  cur.height = box.h;
  (cur.getContext('2d') as CanvasRenderingContext2D).drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const next = document.createElement('canvas');
    next.width = Math.round(cur.width / 2);
    next.height = Math.round(cur.height / 2);
    const ctx = next.getContext('2d') as CanvasRenderingContext2D;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, w, h);
  return out;
}

/** Hard-edged union of module footprints at their mount points (kit rebuildShadow), no blur. */
const SHADOW_SIZE = 1024;
export function buildShadow(scene: Phaser.Scene): void {
  if(scene.textures.exists(SHADOW_KEY))scene.textures.remove(SHADOW_KEY);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SHADOW_SIZE;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (const m of MODULES) {
    const src = scene.textures.get(partKey(m.asset)).getSourceImage() as HTMLCanvasElement;
    const w = CALIBRATION.modules[m.id].width;
    const h = (w * src.height) / src.width;
    ctx.save();
    ctx.translate(SHADOW_SIZE / 2 + m.x, SHADOW_SIZE / 2 + m.y);
    if (m.mirror) ctx.scale(-1, 1);
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#01060c';
  ctx.fillRect(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  scene.textures.addCanvas(SHADOW_KEY, canvas);
}
