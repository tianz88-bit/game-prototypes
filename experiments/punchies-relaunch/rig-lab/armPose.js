const clamp = (v) => Math.max(0, Math.min(1, v));
function armPose(shoulder, fist, cuff, minSegment, outward, straight) {
  const dx = fist.x - shoulder.x, dy = fist.y - shoulder.y;
  const distance = Math.hypot(dx, dy) || 1e-3;
  const segment = Math.max(minSegment, distance * 0.51);
  const bend = Math.sqrt(Math.max(0, segment * segment - distance * distance / 4)) * (1 - clamp(straight));
  const sign = -dy * outward.x + dx * outward.y < 0 ? -1 : 1;
  const elbow = { x: (shoulder.x + fist.x) / 2 - dy / distance * bend * sign, y: (shoulder.y + fist.y) / 2 + dx / distance * bend * sign };
  const forearm = Math.hypot(fist.x - elbow.x, fist.y - elbow.y) || 1;
  const wrist = { x: fist.x - (fist.x - elbow.x) / forearm * cuff, y: fist.y - (fist.y - elbow.y) / forearm * cuff };
  return { elbow, wrist };
}
export {
  armPose
};
