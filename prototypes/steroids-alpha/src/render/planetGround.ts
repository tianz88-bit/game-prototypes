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

void main() {
  vec2 d = fragCoord - resolution * .5;
  d.y *= flipY;
  float r = length(d) / radiusPx;
  if (r >= 1.) {
    // Atmosphere halo outside the disc, brighter on the sunlit side.
    float t = (length(d) - radiusPx) / haloPx;
    if (t >= 1.) { gl_FragColor = vec4(0.); return; }
    float lit = .25 + .75 * smoothstep(-.35, .65, dot(normalize(d), sun.xy));
    float a = .23 * pow(1. - t, 2.) * lit;
    gl_FragColor = vec4(vec3(.32, .62, .82) * a, a);
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
  float lighting = .18 + .86 * max(0., dot(normal, sun));
  colour *= lighting;
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
