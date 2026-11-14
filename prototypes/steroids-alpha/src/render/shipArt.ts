// Loads the approved Human Nomad parts and prepares one runtime texture per part.
// Registration follows the kit's trimFrame(): alpha bounds (alpha > 12) of the untouched source PNG.
// The trimmed region is then resampled once to at most render.partTextureMax px on its long side,
// as the kit's own renderer does (256 px), because parts draw at a small fraction of source size.
// Source files are never modified. If any part fails to load, ships fall back to placeholder shapes.
import Phaser from 'phaser';
import { checkCalibration } from './shipRig';
import type { Calibration } from './shipRig';
import { clientTune } from '../clientTune';
import { SHIP_PROFILES } from './shipProfiles';
import type { ShipProfile } from './shipProfiles';
import { remapPixels } from './palette';
import calibrationJson from '../../art/human-nomad-v1/calibration-approved.json';

export const SHIP_ID = 'human-nomad-v1';
/** The starter's calibration (live settings edit this object). Same object as SHIP_PROFILES[0]'s. */
export const CALIBRATION: Calibration = SHIP_PROFILES[0].calibration;
checkCalibration(calibrationJson);
export const SHADOW_ANCHOR = {...calibrationJson.shadow};

export type ShipArtStatus = 'loading' | 'ready' | 'placeholder';
/** The starter's art: without it every ship falls back to placeholder shapes. */
export let shipArtStatus: ShipArtStatus = 'loading';
/** Which ships' art loaded (by chassis). A missing new ship draws as the starter. */
const ready: boolean[] = SHIP_PROFILES.map(() => false);

const sourceKey = (shipId: string, asset: string): string => `${shipId}-src-${asset}`;
/** Runtime texture key for a part of a ship in a palette (0 = the original art). */
export const partKey = (asset: string, shipId = SHIP_ID, palette = 0): string => `${shipId}-${asset}${palette ? `-p${palette}` : ''}`;
export const shadowKey = (shipId = SHIP_ID): string => `${shipId}-shadow`;
export const SHADOW_KEY = shadowKey();
/** Resampled original part canvases, kept to make palette textures on first use. */
const base = new Map<string, HTMLCanvasElement>();

export function queueShipArt(scene: Phaser.Scene): void {
  for (const p of SHIP_PROFILES) for (const a of p.assets) scene.load.image(sourceKey(p.shipId, a), `assets/loose/${p.shipId}-${a}.png`);
}

/** The profile a ship type draws with: its own, or the starter's while its art is missing. */
export function profileFor(chassis: number): ShipProfile {
  return ready[chassis] ? SHIP_PROFILES[chassis] : SHIP_PROFILES[0];
}

/** Texture key for a part in a palette, making the palette texture the first time it is asked for. */
export function paletteTexture(scene: Phaser.Scene, p: ShipProfile, asset: string, palette: number): string {
  const key = partKey(asset, p.shipId, palette);
  if (palette <= 0 || scene.textures.exists(key)) return palette > 0 ? key : partKey(asset, p.shipId);
  const src = base.get(`${p.shipId}:${asset}`);
  if (!src) return partKey(asset, p.shipId);
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  remapPixels(img.data, palette);
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
  return key;
}

/** Call in create() after the loader finished. Returns the starter's status. */
export function prepareShipArt(scene: Phaser.Scene): ShipArtStatus {
  SHIP_PROFILES.forEach((p, i) => {
    try {
      for (const a of p.assets) {
        if (!scene.textures.exists(sourceKey(p.shipId, a))) throw new Error(`missing ${p.shipId} ${a}`);
      }
      for (const a of p.assets) {
        const src = scene.textures.get(sourceKey(p.shipId, a)).getSourceImage() as HTMLImageElement;
        const box = alphaBounds(src);
        const max = clientTune.render.partTextureMax;
        const k = Math.min(1, max / Math.max(box.w, box.h));
        const canvas = resample(src, box, Math.max(1, Math.round(box.w * k)), Math.max(1, Math.round(box.h * k)));
        base.set(`${p.shipId}:${a}`, canvas);
        scene.textures.addCanvas(partKey(a, p.shipId), canvas);
        scene.textures.remove(sourceKey(p.shipId, a)); // free the full-size source
      }
      ready[i] = true;
    } catch (e) {
      console.warn(`Ship art ${p.shipId} unavailable:`, (e as Error).message);
    }
  });
  if (ready[0]) {
    buildShadow(scene);
    shipArtStatus = 'ready';
  } else {
    console.warn('Starter ship art unavailable, using placeholder shapes');
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
  SHIP_PROFILES.forEach((p, i) => {
    if (ready[i]) buildShadowFor(scene, p);
  });
}

function buildShadowFor(scene: Phaser.Scene, p: ShipProfile): void {
  const key = shadowKey(p.shipId);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SHADOW_SIZE;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (const m of p.modules) {
    const src = scene.textures.get(partKey(m.asset, p.shipId)).getSourceImage() as HTMLCanvasElement;
    const w = p.calibration.modules[m.id].width;
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
  scene.textures.addCanvas(key, canvas);
}
