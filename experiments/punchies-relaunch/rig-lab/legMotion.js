var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class WalkMotion {
  constructor() {
    __publicField(this, "x", NaN);
    __publicField(this, "y", NaN);
    __publicField(this, "time", NaN);
    __publicField(this, "phase", 0);
    __publicField(this, "stride", 0);
    __publicField(this, "direction", { x: 0, y: 0 });
  }
  update(f, now, phasePerPixel) {
    const elapsed = Number.isNaN(this.time) ? 16.667 : Math.max(0, Math.min(100, now - this.time));
    const dx = f.x - this.x, dy = f.y - this.y, distance = Math.hypot(dx, dy);
    const walking = Number.isFinite(distance) && distance < 20 && elapsed > 0 && distance / elapsed > 6e-3 && !f.dodge && !f.stunTimer && !f.pushFrames && !f.anchored;
    if (walking) {
      this.phase += distance * phasePerPixel;
      const target = { x: dx / distance, y: dy / distance }, blend = 1 - Math.exp(-elapsed / 85);
      if (this.stride === 0) this.direction = target;
      else this.direction = { x: this.direction.x + (target.x - this.direction.x) * blend, y: this.direction.y + (target.y - this.direction.y) * blend };
    }
    this.stride += ((walking ? 1 : 0) - this.stride) * (1 - Math.exp(-elapsed / 102.55));
    if (this.stride < 1e-3) {
      this.stride = 0;
      this.direction = { x: 0, y: 0 };
    }
    this.x = f.x;
    this.y = f.y;
    this.time = now;
    return walking;
  }
}
function footCycle(phase) {
  const u = (phase / (2 * Math.PI) % 1 + 1) % 1;
  if (u < 0.6) return { travel: 1 - 2 * u / 0.6, lift: 0 };
  const t = (u - 0.6) / 0.4, smooth = t * t * (3 - 2 * t);
  return { travel: -1 + 2 * smooth, lift: Math.sin(Math.PI * t) };
}
function blendedFootStep(phase, forward, lateral, stride) {
  const cycle = footCycle(phase);
  return { u: 9 * forward * stride * cycle.travel, v: 7 * lateral * stride * cycle.travel, yaw: 0.3 * lateral * stride, lift: cycle.lift * stride };
}
function bootCollar(x, y, rotation, width, collarX = 0.2) {
  const offset = (collarX - 0.5) * width;
  return { x: x + Math.cos(rotation) * offset, y: y + Math.sin(rotation) * offset };
}
export {
  WalkMotion,
  blendedFootStep,
  bootCollar,
  footCycle
};
