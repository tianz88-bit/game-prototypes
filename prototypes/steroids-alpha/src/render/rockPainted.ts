// Painted asteroids (owner art, 14 November 2026): broad cel-shaded rocks matching the ships, three
// colour families (ochre, lavender, teal) with a parent, two medium and two small variants each.
// Replaces the 64px nearest-filtered pixel rocks (rockPixels.ts stays as the fallback when the art
// is missing). Fragments keep the parent's family (server, Asteroid.family); siblings pick
// different variants by id.
//
// Hitbox rule (the "invisible collision" fix): a rock is never drawn smaller than its hitbox. Each
// texture is anchored at the deepest point of its painted body and scaled so the largest circle
// inside the body is at least the collision circle, so the hitbox is always covered by paint.
import Phaser from 'phaser';
import manifest from '../../art/asteroids-v1/asteroid-assets.json';
import richManifest from '../../art/rich-asteroids-v1/assets.json';
import { paintedRockName } from './rockSelection';

const assets=[...manifest.assets,...richManifest.assets];
/** Painted body drawn this much past the hitbox radius (a little margin, never smaller). */
const COVER = 1.04;
const TEXTURE_MAX = 256;

interface RockArt {
  key: string;
  /** Shared damage variants preserve the original alpha/body registration exactly. */
  damaged: [string,string];
  /** Anchor (deepest body point) as a fraction of the trimmed texture. */
  ax: number;
  ay: number;
  /** Largest inscribed circle radius, as a fraction of the trimmed width. */
  inR: number;
  /** Height over width of the trimmed texture. */
  aspect: number;
}

const art = new Map<string, RockArt>();
const srcKey = (name: string): string => `rock-src-${name}`;
let ready = false;

/** Bake fissures only into existing painted pixels; never erode or expand the collision-covering body. */
function damageTextures(scene:Phaser.Scene,base:HTMLCanvasElement,key:string,name:string,ax:number,ay:number,inR:number):[string,string] {
  const keys:[string,string]=[`${key}-worn`,`${key}-fractured`];
  const seed=[...name].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381),angle=(seed%628)/100;
  const cx=base.width*ax,cy=base.height*ay,r=inR*base.width;
  const highlight=name.startsWith('rich-')?'#ffe39a':name.startsWith('lavender')?'#d6cbe5':name.startsWith('teal')?'#c1e2cd':'#f7c989';
  keys.forEach((damageKey,stage)=>{
    if(scene.textures.exists(damageKey))scene.textures.remove(damageKey);
    const canvas=document.createElement('canvas');canvas.width=base.width;canvas.height=base.height;
    const ctx=canvas.getContext('2d') as CanvasRenderingContext2D;ctx.drawImage(base,0,0);
    ctx.globalCompositeOperation='source-atop';ctx.lineJoin='bevel';ctx.lineCap='butt';
    for(let branch=0;branch<(stage?4:2);branch++){
      const a=angle+branch*(stage?1.57:2.7),ca=Math.cos(a),sa=Math.sin(a),spread=r*(stage?.95:.7);
      const points=[[cx-ca*r*.18,cy-sa*r*.18],[cx+ca*spread*.22-sa*r*.12,cy+sa*spread*.22+ca*r*.12],[cx+ca*spread*.56+sa*r*.08,cy+sa*spread*.56-ca*r*.08],[cx+ca*spread,cy+sa*spread]];
      const stroke=(offset:number,width:number,colour:string)=>{
        ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x-sa*offset,y+ca*offset):ctx.moveTo(x-sa*offset,y+ca*offset));ctx.stroke();
      };
      stroke(1.1,Math.max(1.5,r*.045),highlight);
      stroke(0,Math.max(1.8,r*(stage?.055:.04)),'#292635');
      if(stage){
        const mid=points[2];ctx.strokeStyle='#302b3b';ctx.lineWidth=Math.max(1.2,r*.025);ctx.beginPath();ctx.moveTo(mid[0],mid[1]);ctx.lineTo(mid[0]+Math.cos(a+.9)*r*.2,mid[1]+Math.sin(a+.9)*r*.2);ctx.stroke();
      }
    }
    ctx.globalCompositeOperation='source-over';
    scene.textures.addCanvas(damageKey,canvas)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
  });
  return keys;
}

export function queuePaintedRocks(scene: Phaser.Scene): void {
  for (const a of assets) scene.load.image(srcKey(a.name), `assets/loose/asteroid-${a.name}.png`);
}

/** Call after loading. Returns false (pixel rocks stay) if any painted rock is missing. */
export function preparePaintedRocks(scene: Phaser.Scene): boolean {
  try {
    for (const a of manifest.assets) if (!scene.textures.exists(srcKey(a.name))) throw new Error(`missing ${a.name}`);
    for (const a of assets) {
      // A missing rich variant falls back to the matching ordinary painted rock.
      if(!scene.textures.exists(srcKey(a.name)))continue;
      const img = scene.textures.get(srcKey(a.name)).getSourceImage() as HTMLImageElement;
      const full = document.createElement('canvas');
      full.width = img.naturalWidth;
      full.height = img.naturalHeight;
      const fctx = full.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      fctx.drawImage(img, 0, 0);
      const data = fctx.getImageData(0, 0, full.width, full.height).data;
      // Trim to the painted pixels (alpha > 12), as the ship parts are.
      let l = full.width, t = full.height, r = 0, b = 0;
      for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) {
        if (data[(y * full.width + x) * 4 + 3] > 12) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
      }
      const w = r - l + 1;
      const h = b - t + 1;
      // Deepest body point: chamfer distance to the nearest unpainted pixel on a coarse grid.
      const N = 96;
      const gw = Math.max(8, Math.round(w > h ? N : (N * w) / h));
      const gh = Math.max(8, Math.round(w > h ? (N * h) / w : N));
      const dist = new Float32Array(gw * gh);
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        const sx = l + Math.floor(((gx + 0.5) * w) / gw);
        const sy = t + Math.floor(((gy + 0.5) * h) / gh);
        const inside = data[(sy * full.width + sx) * 4 + 3] > 12 && gx > 0 && gy > 0 && gx < gw - 1 && gy < gh - 1;
        dist[gy * gw + gx] = inside ? 1e9 : 0;
      }
      const at = (x: number, y: number): number => dist[y * gw + x];
      for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
        dist[y * gw + x] = Math.min(at(x, y), at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + Math.SQRT2, at(x + 1, y - 1) + Math.SQRT2);
      }
      for (let y = gh - 2; y > 0; y--) for (let x = gw - 2; x > 0; x--) {
        dist[y * gw + x] = Math.min(at(x, y), at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + Math.SQRT2, at(x - 1, y + 1) + Math.SQRT2);
      }
      let best = 0, bx = gw / 2, by = gh / 2;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (dist[y * gw + x] > best) { best = dist[y * gw + x]; bx = x; by = y; }
      // A grid cell is w/gw texture pixels; keep half a cell back so the circle stays inside the paint.
      const inR = Math.max(0.05, (best - 0.5) / gw);
      // Smooth (linear-filtered) texture, at most TEXTURE_MAX px on its long side.
      const k = Math.min(1, TEXTURE_MAX / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(full, l, t, w, h, 0, 0, c.width, c.height);
      const key = `rock-painted-${a.name}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
      scene.textures.remove(srcKey(a.name));
      const ax=(bx+.5)/gw,ay=(by+.5)/gh;
      const damaged=damageTextures(scene,c,key,a.name,ax,ay,inR);
      art.set(a.name, { key, damaged, ax, ay, inR, aspect: h / w });
    }
    ready = true;
  } catch (e) {
    console.warn('Painted asteroids unavailable, keeping pixel rocks:', (e as Error).message);
    ready = false;
  }
  return ready;
}

export const paintedRocksReady = (): boolean => ready;

/** Which painted rock an asteroid uses: its family and size, siblings alternating variants. */
export function rockArtFor(id: number, size: number, family: number,rich=false): RockArt {
  return (art.get(paintedRockName(id,size,family,rich))??art.get(paintedRockName(id,size,family))) as RockArt;
}

/** How big a painted rock is drawn for a hit radius r (world units): its body covers the hitbox. */
export function rockExtent(a: RockArt, r: number): { width: number; height: number; left: number; top: number } {
  const width = (r * COVER) / a.inR;
  const height = width * a.aspect;
  return { width, height, left: -a.ax * width, top: -a.ay * height };
}

/** Painted sprites bent through the planet projection on a 4x4 surface grid (as PixelRocks). */
export class PaintedRocks {
  private active = new Map<number, Phaser.GameObjects.Mesh | Phaser.GameObjects.Image>();
  private pool: (Phaser.GameObjects.Mesh | Phaser.GameObjects.Image)[] = [];
  private seen = new Set<number>();
  constructor(private scene: Phaser.Scene) {}
  begin(): void {
    this.seen.clear();
  }
  draw(id: number, x: number, y: number, r: number, hp: number, flash: boolean, light: number, sun: { x: number; y: number }, project: (x: number, y: number) => { x: number; y: number; visible: boolean }, size: number, family: number,rich=false): void {
    const a = rockArtFor(id, size, family,rich);
    if (!a) return;
    const e = rockExtent(a, r);
    // A fixed turn per rock (by id) so the same art does not repeat at the same angle.
    const turn = id * 2.399;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const points = Array.from({ length: 25 }, (_, i) => {
      const lx = e.left + ((i % 5) / 4) * e.width;
      const ly = e.top + (Math.floor(i / 5) / 4) * e.height;
      return project(x + lx * c - ly * s, y + lx * s + ly * c);
    });
    if (points.some((p) => !p.visible)) return;
    let mesh = this.active.get(id);
    if (!mesh) {
      mesh = this.pool.pop();
      if (!mesh) {
        if (this.scene.game.renderer.type === Phaser.CANVAS) mesh = this.scene.add.image(0, 0, a.key).setDepth(14).setActive(false);
        else {
          const vertices: number[] = [];
          const uvs: number[] = [];
          const indices: number[] = [];
          for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { vertices.push(i, j); uvs.push(i / 4, j / 4); }
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const q = j * 5 + i; indices.push(q, q + 5, q + 1, q + 1, q + 5, q + 6); }
          mesh = this.scene.add.mesh(0, 0, a.key, undefined, vertices, uvs, indices).setDepth(14).setActive(false);
          mesh.hideCCW = false;
        }
      }
      this.active.set(id, mesh);
    }
    const damageKey=hp<.35?a.damaged[1]:hp<.7?a.damaged[0]:a.key;
    mesh.setTexture(damageKey).setVisible(true);
    mesh.tintFill = flash;
    this.seen.add(id);
    if (mesh instanceof Phaser.GameObjects.Image) {
      const left = points[10], right = points[14], top = points[2], bottom = points[22];
      const mid = { x: (points[0].x + points[24].x) / 2, y: (points[0].y + points[24].y) / 2 };
      mesh.setPosition(mid.x, mid.y).setDisplaySize(Math.hypot(right.x - left.x, right.y - left.y), Math.hypot(bottom.x - top.x, bottom.y - top.y)).setRotation(Math.atan2(right.y - left.y, right.x - left.x));
      const shade=flash?255:Math.round(255*Math.max(.22,light*(.9+.1*Math.max(0,Math.min(1,hp)))));
      mesh.setTint((shade<<16)|(shade<<8)|shade);
      return;
    }
    // Shared baked fissure stages carry damage, while only a restrained wear tint affects the paint.
    const wear = 0.9 + 0.1 * Math.max(0, Math.min(1, hp));
    for (const v of mesh.vertices) {
      const i = Math.round(v.u * 4);
      const j = Math.round(v.v * 4);
      const q = points[j * 5 + i];
      v.vx = q.x;
      v.vy = q.y;
      v.vz = 0;
      const shade = Math.min(1, Math.max(0.22, light * wear * (0.93 + 0.07 * (((i - 2) * sun.x + (j - 2) * sun.y) / 2))));
      const col = flash ? 255 : Math.round(shade * 255);
      v.color = (col << 16) | (col << 8) | col;
    }
  }
  end(): void {
    for (const [id, mesh] of this.active) if (!this.seen.has(id)) { mesh.setVisible(false); this.pool.push(mesh); this.active.delete(id); }
  }
}

/** Test hook: each painted rock's drawn width relative to its hitbox diameter (always above 1). */
export function rockCoverage(): { name: string; widthOverHitbox: number; anchor: [number, number] }[] {
  return [...art.entries()].map(([name, a]) => ({ name, widthOverHitbox: rockExtent(a, 1).width / 2, anchor: [a.ax, a.ay] }));
}
