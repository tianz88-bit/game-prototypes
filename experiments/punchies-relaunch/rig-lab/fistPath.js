const activeEnd = (p) => p.startup + p.sourEarly + p.sweet + p.sour;
import { tune } from "./geometry-tune.js";
const clamp = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const smooth = (t) => t * t * (3 - 2 * t);
function punchExtension(p) {
  if (p.frame < p.startup) return 0;
  if (p.frame < activeEnd(p)) return clamp((p.frame - p.startup + 1) / (p.sourEarly + 1));
  return Math.pow(1 - clamp((p.frame - activeEnd(p)) / Math.max(1, p.recovery)), 3);
}
function punchFist(f, p, k) {
  const side = p.hand === 0 ? 1 : -1;
  const rest = { x: f.x + (f.fx * 15 + f.fy * 15 * side) * k, y: f.y + (f.fy * 15 - f.fx * 15 * side) * k };
  const point = (angle) => ({ x: f.x + p.reach * (f.fx * Math.cos(angle) + f.fy * Math.sin(angle)), y: f.y + p.reach * (f.fy * Math.cos(angle) - f.fx * Math.sin(angle)) });
  if (p.type !== "hook") {
    const t = p.frame < p.startup ? -0.15 * smooth(clamp(p.frame / Math.max(1, p.startup))) : punchExtension(p);
    return mix(rest, point(0), t);
  }
  const rig = tune.view.puppet;
  const windup = side * rig.hookWindupDegrees * Math.PI / 180;
  const follow = -side * rig.hookFollowDegrees * Math.PI / 180;
  if (p.frame < p.startup) return mix(rest, point(windup), smooth(clamp(p.frame / Math.max(1, p.startup))));
  const sweetStart = p.startup + p.sourEarly;
  if (p.frame <= sweetStart) {
    const t = clamp((p.frame - p.startup + 1) / (p.sourEarly + 1));
    return point(windup * Math.pow(1 - t, rig.hookSnapPower));
  }
  if (p.frame < activeEnd(p)) {
    const t = clamp((p.frame - sweetStart) / Math.max(1, p.sweet + p.sour));
    return point(follow * (1 - Math.pow(1 - t, rig.hookSnapPower)));
  }
  const lastT = clamp((p.sweet + p.sour - 1) / Math.max(1, p.sweet + p.sour));
  const last = point(follow * (1 - Math.pow(1 - lastT, rig.hookSnapPower)));
  return mix(last, rest, 1 - punchExtension(p));
}
export {
  punchExtension,
  punchFist
};
