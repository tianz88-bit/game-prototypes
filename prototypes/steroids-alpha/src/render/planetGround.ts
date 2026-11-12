// The planet's surface, rim and atmosphere halo, drawn by one fragment shader on a full-screen quad.
// Port of the handoff's PlanetGround (environment-lab/planet-ground.mjs): the same textures, lighting,
// horizon tint, Soft Light rim and outer halo. The lab used a mesh to avoid per-pixel trig; here the
// inverse projection is done per pixel, which keeps it a single Phaser Shader object with no uploads
// per frame. Needs WebGL; on the Canvas renderer the planet is a flat disc.
import Phaser from 'phaser';
import { TUNE } from '../../sim/tune';
import { clientTune } from '../clientTune';
import type { PlanetFrame } from './planet';

export const GROUND_TILE = 'terrain-ground-tile';
export const SAND_CHANNEL = 'terrain-sand-channel';

export function queueTerrain(scene: Phaser.Scene): void {
  scene.load.svg(GROUND_TILE, 'assets/loose/ground-tile.svg', { width: 512, height: 512 });
  scene.load.svg(SAND_SOURCE, 'assets/loose/sand-channel.svg', { width: 1200, height: 900 });
}

const SAND_SOURCE = 'terrain-sand-channel-source';

/**
 * Call once after loading. WebGL 1 cannot sample a texture whose sides are not powers of two the way
 * this shader needs, so the 1200 x 900 sand art is resampled once to 1024 x 1024. The shader addresses
 * it in 0..1 coordinates, so the stretch does not change how it looks on the ground.
 */
export function prepareTerrain(scene: Phaser.Scene): void {
  if (!scene.textures.exists(SAND_SOURCE) || scene.textures.exists(SAND_CHANNEL)) return;
  const src = scene.textures.get(SAND_SOURCE).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, 1024, 1024);
  scene.textures.addCanvas(SAND_CHANNEL, canvas);
  scene.textures.remove(SAND_SOURCE);
}

// The base tile repeats every 500 world units and the sand channels on a (3,-1)/(1,4) lattice over the
// map width, so both repeat exactly across the wrapping map's seam. (The lab used 512 and a rotated
// 1200 x 900, which do not divide the map.)
const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 camera;
uniform float radiusPx;
uniform float worldRadius;
uniform float haloPx;
uniform float mapSize;
uniform vec3 sun;
uniform float flipY;
varying vec2 fragCoord;

vec3 softLight(vec3 b, vec3 l) {
  vec3 low = b - (1. - 2. * l) * b * (1. - b);
  vec3 high = b + (2. * l - 1.) * (sqrt(max(b, vec3(0.))) - b);
  return mix(low, high, step(vec3(.5), l));
}

// Periodic, stationary surface detail: no time term, extra texture fetches or draw objects.
// Integer cell counts divide the wrapping map, including negative camera coordinates.
float groundHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float groundNoise(vec2 p, float cells) {
  vec2 v = p / mapSize * cells;
  vec2 i = floor(v);
  vec2 f = fract(v);
  f = f * f * (3. - 2. * f);
  return mix(mix(groundHash(mod(i, cells)), groundHash(mod(i + vec2(1., 0.), cells)), f.x),
             mix(groundHash(mod(i + vec2(0., 1.), cells)), groundHash(mod(i + 1., cells)), f.x), f.y);
}

void main() {
  vec2 d = fragCoord - resolution * .5;
  d.y *= flipY;
  float r = length(d) / radiusPx;
  if (r >= 1.) {
    // Atmosphere halo outside the disc, brighter on the sunlit side.
    float t = (length(d) - radiusPx) / haloPx;
    if (t >= 1.) { gl_FragColor = vec4(0.); return; }
    float lit = .18 + .82 * smoothstep(-.35, .65, dot(normalize(d), sun.xy));
    float a = .28 * pow(1. - t, 2.) * lit;
    gl_FragColor = vec4(vec3(.37, .67, .90) * a, a);
    return;
  }
  vec3 normal = vec3(d / radiusPx, sqrt(max(0., 1. - r * r)));
  float depth = normal.z;
  // Inverse of the projection: screen distance R sin(theta) back to ground distance R theta.
  float theta = asin(min(r, 1.));
  vec2 dir = r > 1e-5 ? d / (r * radiusPx) : vec2(0.);
  vec2 world = dir * worldRadius * theta + camera;
  vec3 colour = texture2D(iChannel0, fract(world / 500.)).rgb;
  vec2 sw = vec2(3. * world.x - world.y, world.x + 4. * world.y) / mapSize + vec2(0., .5);
  vec4 s = texture2D(iChannel1, fract(sw));
  colour = mix(colour, s.rgb, s.a * .66);
  // Broad mineral/dust patches remain quieter than collidable rocks and amber pickups.
  float dust = groundNoise(world, 48.);
  colour *= .91 + .18 * dust;
  colour = mix(colour, colour * vec3(1.10, .93, .97), smoothstep(.48, .82, dust) * .5);
  // One shallow depression per selected cell. The radius stays inside its cell, so no
  // neighbouring-cell search is needed and there are no clipped craters at tile seams.
  vec2 cell = floor(world / mapSize * 24.);
  vec2 id = mod(cell, 24.);
  float seed = groundHash(id);
  vec2 centre = vec2(.5) + (vec2(groundHash(id + 41.), groundHash(id + 73.)) - .5) * .22;
  vec2 pit = fract(world / mapSize * 24.) - centre;
  float size = mix(.15, .28, groundHash(id + 19.));
  float cr = length(pit) / size;
  float present = step(.58, seed) * (1. - s.a * .85);
  float bowl = (1. - smoothstep(.55, .94, cr)) * present;
  float lip = (smoothstep(.78, .94, cr) - smoothstep(.96, 1.12, cr)) * present;
  // Relief follows the same local sun as ships and their shadows, even after map wraps.
  vec2 slope = pit / max(length(pit), .001);
  float relief = dot(slope, sun.xy) * (lip - bowl * .35);
  colour *= 1. - bowl * .12 + lip * .08 + relief * .15;
  // The alpha feather of the existing sand art supplies a small bank at either edge.
  float bank = (smoothstep(.05, .20, s.a) - smoothstep(.25, .46, s.a));
  colour *= 1. - bank * .10;
  float facing = dot(normal, sun);
  float lighting = .20 + .84 * max(0., facing);
  vec3 night = vec3(.50, .62, .94);
  vec3 day = vec3(1.07, 1.01, .95);
  colour *= lighting * mix(night, day, smoothstep(-.16, .24, facing));
  float dusk = (smoothstep(-.22, -.02, facing) - smoothstep(.04, .28, facing));
  colour += vec3(.055, .018, .009) * dusk;
  colour = mix(vec3(.39, .35, .48) * lighting, colour, smoothstep(0., .17, depth));
  float rim = 1. - smoothstep(0., .48, depth);
  float lit = .28 + .72 * smoothstep(-.35, .65, dot(normal, sun));
  colour = mix(colour, softLight(colour, vec3(.40, .72, .86)), rim * .72 * lit);
  // Soften the very edge so the limb is not a hard pixel stair.
  float edge = smoothstep(0., 1.5 / radiusPx, 1. - r);
  gl_FragColor = vec4(colour * edge, edge);
}
`;

export class PlanetGround {
  private shader: Phaser.GameObjects.Shader | null = null;
  private disc: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private scene: Phaser.Scene,
    depth: number,
  ) {
    if (scene.game.renderer.type === Phaser.WEBGL && scene.textures.exists(GROUND_TILE) && scene.textures.exists(SAND_CHANNEL)) {
      const base = new Phaser.Display.BaseShader('planet-ground', FRAGMENT, undefined, {
        camera: { type: '2f', value: { x: 0, y: 0 } },
        radiusPx: { type: '1f', value: 100 },
        worldRadius: { type: '1f', value: clientTune.render.planetRadius },
        haloPx: { type: '1f', value: clientTune.render.haloWidth },
        mapSize: { type: '1f', value: TUNE.world.width },
        sun: { type: '3f', value: { x: 0, y: 0, z: 1 } },
        flipY: { type: '1f', value: 1 },
      });
      this.shader = scene.add.shader(base, 0, 0, 16, 16, [GROUND_TILE, SAND_CHANNEL]).setOrigin(0).setDepth(depth);
    } else {
      this.disc = scene.add.graphics().setDepth(depth);
    }
  }

  /** w, h: logical screen size. viewScale: screen pixels per world unit. */
  update(w: number, h: number, viewScale: number, frame: PlanetFrame): void {
    const radiusPx = clientTune.render.planetRadius * viewScale;
    if (this.shader) {
      const s = this.shader;
      if (s.width !== w || s.height !== h) s.setSize(w, h);
      s.setUniform('camera.value', frame.camera);
      s.setUniform('radiusPx.value', radiusPx);
      s.setUniform('worldRadius.value', clientTune.render.planetRadius);
      s.setUniform('haloPx.value', clientTune.render.haloWidth * viewScale);
      s.setUniform('sun.value', frame.sun);
      s.setUniform('flipY.value', FLIP_Y);
    } else if (this.disc) {
      const k = Math.round(0x88 * frame.brightness);
      this.disc.clear();
      this.disc.fillStyle((k << 16) | (Math.round(0x65 * frame.brightness) << 8) | Math.round(0x78 * frame.brightness), 1);
      this.disc.fillCircle(w / 2, h / 2, radiusPx);
    }
  }
}

/** Phaser's Shader quad passes fragCoord with y up; the planet maths uses y down the screen. */
const FLIP_Y = -1;
