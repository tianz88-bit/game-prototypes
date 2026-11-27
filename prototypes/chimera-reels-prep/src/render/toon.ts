// Cel-shaded placeholder art kit, following the Kimberly Tank Study:
// three-tone toon ramp with hard specular, rim and painted wear; inverted
// hull outlines built from smoothed normals; chamfered primitives; damped
// springs for secondary motion; toon puffs that dissolve with noise.
// All art is generated in code, so nothing is committed as an asset file.
import * as THREE from 'three';

export const LIGHT = {
  uKey: { value: new THREE.Vector3(-0.45, 0.8, 0.4).normalize() },
  uFill: { value: new THREE.Vector3(0.85, -0.05, 0.25).normalize() },
  uFillCol: { value: new THREE.Color('#6f86ff') },
};

const NOISE_GLSL = `
float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x), mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x), mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y), f.z); }`;

const TOON_VS = `
varying vec3 vN; varying vec3 vW; varying vec3 vO;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vO = position;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TOON_FS = `
uniform vec3 uBase, uShade, uDeep, uSpec;
uniform float uGloss, uSpecAmt, uRim, uWear, uFlash;
uniform vec3 uKey, uFill, uFillCol;
varying vec3 vN; varying vec3 vW; varying vec3 vO;
${NOISE_GLSL}
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  float nl = dot(N, uKey);
  float core = smoothstep(-0.42, -0.36, nl);
  float lit  = smoothstep(0.02, 0.07, nl);
  float hot  = smoothstep(0.62, 0.67, nl);
  vec3 col = mix(uDeep, uShade, core);
  col = mix(col, uBase, lit);
  col = mix(col, uBase * 1.1 + 0.04, hot * 0.55);
  float fl = smoothstep(0.25, 0.32, dot(N, uFill));
  col += uFillCol * fl * (1.0 - lit) * 0.16;
  col *= mix(0.82, 1.0, smoothstep(-0.75, -0.35, N.y));
  vec3 H = normalize(uKey + V);
  float sp = pow(max(dot(N, H), 0.0), uGloss);
  sp = smoothstep(0.5, 0.56, sp) * uSpecAmt * lit;
  col = mix(col, uSpec, sp);
  float rim = 1.0 - max(dot(N, V), 0.0);
  rim = smoothstep(0.66, 0.72, rim) * uRim * (0.35 + 0.65 * lit);
  col = mix(col, uSpec, rim * 0.45);
  float n = vnoise(vO * 7.0) * 0.6 + vnoise(vO * 23.0) * 0.4;
  col *= 1.0 + (n - 0.5) * uWear;
  col = mix(col, vec3(1.0, 0.96, 0.85), uFlash);
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}`;

export type ToonMat = THREE.ShaderMaterial & { userData: { outline: THREE.Color } };

/** Toon material from one base colour; shade, deep and outline are derived. */
export function toon(base: string, o: { gloss?: number; spec?: number; rim?: number; wear?: number } = {}): ToonMat {
  const b = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  b.getHSL(hsl);
  const shade = new THREE.Color().setHSL((hsl.h + 0.98) % 1, Math.min(1, hsl.s * 1.1), hsl.l * 0.68);
  const deep = new THREE.Color().setHSL((hsl.h + 0.96) % 1, Math.min(1, hsl.s * 1.15), hsl.l * 0.4);
  const spec = new THREE.Color().setHSL(hsl.h, hsl.s * 0.4, Math.min(0.97, hsl.l + 0.4));
  const m = new THREE.ShaderMaterial({
    vertexShader: TOON_VS,
    fragmentShader: TOON_FS,
    uniforms: {
      uBase: { value: b }, uShade: { value: shade }, uDeep: { value: deep }, uSpec: { value: spec },
      uGloss: { value: o.gloss ?? 40 }, uSpecAmt: { value: o.spec ?? 0.6 }, uRim: { value: o.rim ?? 0.55 },
      uWear: { value: o.wear ?? 0.07 }, uFlash: { value: 0 },
      uKey: LIGHT.uKey, uFill: LIGHT.uFill, uFillCol: LIGHT.uFillCol,
    },
  }) as ToonMat;
  m.userData.outline = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.9), Math.max(0.05, hsl.l * 0.22));
  return m;
}

// ------------------------------------------------------------ outlines

const OUTLINE_VS = `
attribute vec3 smoothNormal;
uniform float uThick;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * smoothNormal);
  float d = length(cameraPosition - w.xyz);
  w.xyz += n * uThick * clamp(d * 0.075, 0.6, 2.2);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const OUTLINE_FS = `uniform vec3 uColor; void main(){ gl_FragColor = linearToOutputTexel(vec4(uColor, 1.0)); }`;

export function outlineMat(color: THREE.Color, thick = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VS,
    fragmentShader: OUTLINE_FS,
    side: THREE.BackSide,
    uniforms: { uThick: { value: 0.02 * thick }, uColor: { value: color.clone() } },
  });
}

function ensureSmooth(g: THREE.BufferGeometry) {
  if (g.attributes.smoothNormal) return;
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const sums = new Map<string, number[]>();
  const keys: string[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    keys.push(k);
    const a = sums.get(k) ?? [0, 0, 0];
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
    sums.set(k, a);
  }
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const a = sums.get(keys[i])!;
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  g.setAttribute('smoothNormal', new THREE.BufferAttribute(out, 3));
}

export interface PartMesh extends THREE.Mesh {
  userData: { outline?: THREE.Mesh };
}

/** A toon mesh with its own outline shell, added to `parent`. */
export function part(
  geo: THREE.BufferGeometry, mat: ToonMat, parent: THREE.Object3D,
  pos?: [number, number, number], rot?: [number, number, number], outline = 1,
): PartMesh {
  ensureSmooth(geo);
  const m = new THREE.Mesh(geo, mat) as unknown as PartMesh;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (outline > 0) {
    const o = new THREE.Mesh(geo, outlineMat(mat.userData.outline, outline));
    o.userData.base = mat.userData.outline.clone();
    o.userData.thick = outline;
    m.add(o);
    m.userData.outline = o;
  }
  parent.add(m);
  return m;
}

// ------------------------------------------------------------ geometry

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, fn: () => THREE.BufferGeometry) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key)!;
}

/** Box with chamfered edges. */
export function cbox(w: number, h: number, d: number, b = 0.06) {
  return cached(`cb${w},${h},${d},${b}`, () => {
    b = Math.min(b, w / 2 - 0.002, h / 2 - 0.002);
    const s = new THREE.Shape();
    const x = w / 2 - b;
    const y = h / 2 - b;
    s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.lineTo(w / 2, -y); s.lineTo(w / 2, y);
    s.lineTo(x, h / 2); s.lineTo(-x, h / 2); s.lineTo(-w / 2, y); s.lineTo(-w / 2, -y); s.closePath();
    const dd = Math.max(0.001, d - 2 * b);
    const g = new THREE.ExtrudeGeometry(s, { depth: dd, bevelEnabled: true, bevelThickness: b, bevelSize: 0.0001, bevelSegments: 1 });
    g.translate(0, 0, -dd / 2);
    return g;
  });
}

export const sphere = (r: number, ws = 18, hs = 12) => cached(`sp${r},${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
export const cyl = (rt: number, rb: number, h: number, seg = 12) => cached(`cy${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const cone = (r: number, h: number, seg = 10) => cached(`co${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));

// ------------------------------------------------------------ springs

const TAU = Math.PI * 2;

/** Damped spring on (pitch, roll, heave), driven by its parent's displacement. */
export class Spring {
  private k: number;
  private c: number;
  x = [0, 0, 0];
  v = [0, 0, 0];
  private base: { rx: number; rz: number; y: number };
  constructor(private obj: THREE.Object3D, private parent: Spring | null, f: number, z: number, private s: [number, number, number], private g = 1) {
    const w = TAU * f;
    this.k = w * w;
    this.c = 2 * z * w;
    this.base = { rx: obj.rotation.x, rz: obj.rotation.z, y: obj.position.y };
  }
  step(dt: number) {
    const inp = this.parent ? this.parent.x : [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const a = this.k * (this.g * inp[i] - this.x[i]) - this.c * this.v[i];
      this.v[i] += a * dt;
      this.x[i] += this.v[i] * dt;
    }
  }
  apply() {
    this.obj.rotation.x = this.base.rx + this.x[0] * this.s[0];
    this.obj.rotation.z = this.base.rz + this.x[1] * this.s[1];
    this.obj.position.y = this.base.y + this.x[2] * this.s[2];
  }
  kick(p: number, r = 0, h = 0) {
    this.v[0] += p; this.v[1] += r; this.v[2] += h;
  }
}

// ------------------------------------------------------------ VFX

const PUFF_FS = `
uniform vec3 uCol, uShade, uHot, uKey; uniform float uDis, uHeat, uSeed;
varying vec3 vN; varying vec3 vW; varying vec3 vO;
${NOISE_GLSL}
void main(){
  float n = vnoise(vO * 2.6 + uSeed) * 0.7 + vnoise(vO * 6.0 + uSeed) * 0.3;
  if (n < uDis) discard;
  vec3 N = normalize(vN);
  float l = smoothstep(0.0, 0.08, dot(N, uKey));
  vec3 col = mix(uShade, uCol, l);
  col = mix(col, uHot, uHeat);
  col = mix(col, uShade * 0.85, (1.0 - smoothstep(uDis, uDis + 0.06, n)) * step(0.01, uDis));
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}`;

interface Puff {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  vel: THREE.Vector3;
  age: number; life: number; s0: number; s1: number; heat: number; drag: number; rise: number;
}

export class Vfx {
  private puffs: Puff[] = [];
  private pool: Puff['mesh'][] = [];
  private flashes: { mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>; age: number; size: number }[] = [];
  private puffGeo = new THREE.SphereGeometry(1, 14, 10);
  private flashGeo = new THREE.IcosahedronGeometry(1, 0);
  private template = new THREE.ShaderMaterial({
    vertexShader: TOON_VS,
    fragmentShader: PUFF_FS,
    uniforms: {
      uCol: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHot: { value: new THREE.Color('#ffd25a') },
      uKey: LIGHT.uKey, uDis: { value: 0 }, uHeat: { value: 0 }, uSeed: { value: 0 },
    },
  });

  constructor(private scene: THREE.Scene) {}

  puff(pos: THREE.Vector3, vel: THREE.Vector3, o: { col: string; shade: string; life: number; s0: number; s1: number; heat?: number; drag?: number; rise?: number }) {
    let mesh = this.pool.pop();
    if (!mesh) {
      const mat = this.template.clone();
      mat.uniforms.uKey = LIGHT.uKey;
      mesh = new THREE.Mesh(this.puffGeo, mat);
    }
    const u = mesh.material.uniforms;
    u.uCol.value.set(o.col); u.uShade.value.set(o.shade); u.uSeed.value = Math.random() * 50; u.uDis.value = 0; u.uHeat.value = o.heat ?? 0;
    mesh.position.copy(pos);
    mesh.scale.setScalar(o.s0);
    this.scene.add(mesh);
    this.puffs.push({ mesh, vel: vel.clone(), age: 0, life: o.life, s0: o.s0, s1: o.s1, heat: o.heat ?? 0, drag: o.drag ?? 2, rise: o.rise ?? 0.6 });
  }

  /** Burst of puffs around a point, e.g. an impact or a part break. */
  burst(pos: THREE.Vector3, n: number, o: { col: string; shade: string; speed: number; size: number; heat?: number }) {
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      this.puff(pos, dir.multiplyScalar(o.speed * (0.5 + Math.random())), {
        col: o.col, shade: o.shade, life: 0.45 + Math.random() * 0.3, s0: o.size * 0.4, s1: o.size * (0.9 + Math.random() * 0.5), heat: o.heat, drag: 4, rise: 0.8,
      });
    }
  }

  flash(pos: THREE.Vector3, size = 1, color = '#fff2a8') {
    const mesh = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.copy(pos);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.scene.add(mesh);
    this.flashes.push({ mesh, age: 0, size });
  }

  update(dt: number) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.scene.remove(p.mesh);
        this.puffs.splice(i, 1);
        this.pool.push(p.mesh);
        continue;
      }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.vel.y += p.rise * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - t, 3)));
      const u = p.mesh.material.uniforms;
      u.uDis.value = Math.max(0, (t - 0.35) / 0.65) * 1.02;
      u.uHeat.value = p.heat * Math.max(0, 1 - p.age / 0.18);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      const t = f.age / 0.16;
      if (t >= 1) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.flashes.splice(i, 1);
        continue;
      }
      f.mesh.scale.setScalar((0.2 + t * 0.45) * f.size);
      f.mesh.material.opacity = 1 - t;
      f.mesh.material.color.set(t < 0.4 ? '#fff6c4' : '#ffb13b');
    }
  }
}

// ------------------------------------------------------------ ground

/** Flat arena floor with a stepped toon contact shadow under each monster. */
export function makeGround(shadowAt: THREE.Vector2[]): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCol: { value: new THREE.Color('#3a3157') }, uLine: { value: new THREE.Color('#4a3f6e') }, uShadow: { value: new THREE.Color('#1e1830') },
      uA: { value: shadowAt[0] }, uB: { value: shadowAt[1] },
    },
    vertexShader: `varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec2 vXZ; uniform vec3 uCol, uLine, uShadow; uniform vec2 uA, uB;
      float ring(float d, float r, float w){ return 1.0 - smoothstep(0.0, w, abs(d - r)); }
      float shadow(vec2 c){ float s = length((vXZ - c) * vec2(0.85, 1.1)); return (1.0 - smoothstep(0.78, 0.82, s)) * 0.5 + (1.0 - smoothstep(0.5, 0.54, s)) * 0.25; }
      void main(){
        float d = length(vXZ);
        float fade = 1.0 - smoothstep(4.2, 6.5, d);
        vec3 col = mix(uCol, uLine, max(ring(d, 3.9, 0.06), ring(d, 2.2, 0.03) * 0.6));
        col = mix(col, uShadow, max(shadow(uA), shadow(uB)));
        gl_FragColor = linearToOutputTexel(vec4(col, fade));
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = -1;
  return ground;
}
