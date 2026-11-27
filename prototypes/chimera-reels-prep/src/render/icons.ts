// Placeholder tile icons drawn with the canvas 2D API, until the owner
// supplies art. Each icon fits a size x size box centred on (cx, cy).
import type { TileId } from '../sim/content';

type G = CanvasRenderingContext2D;

function stroke(g: G, w: number) {
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}

function flame(g: G, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y - s * 0.5);
  g.bezierCurveTo(x + s * 0.45, y - s * 0.1, x + s * 0.35, y + s * 0.45, x, y + s * 0.45);
  g.bezierCurveTo(x - s * 0.35, y + s * 0.45, x - s * 0.45, y - s * 0.05, x - s * 0.1, y - s * 0.2);
  g.quadraticCurveTo(x - s * 0.05, y, x, y - s * 0.5);
  g.fill();
}

function slash(g: G, x0: number, y0: number, x1: number, y1: number, w: number) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.2, (y0 + y1) / 2, x1, y1);
  stroke(g, w);
}

export function drawIcon(g: G, id: TileId, cx: number, cy: number, size: number, color = '#ffffff') {
  const s = size;
  g.save();
  g.translate(cx, cy);
  g.fillStyle = color;
  g.strokeStyle = color;
  const w = Math.max(1.5, s * 0.11);
  switch (id) {
    case 'claw':
      for (let i = -1; i <= 1; i++) slash(g, -s * 0.3 + i * s * 0.22, -s * 0.38, s * 0.1 + i * s * 0.22, s * 0.38, w);
      break;
    case 'rend':
      slash(g, -s * 0.38, -s * 0.38, s * 0.38, s * 0.38, w * 1.3);
      slash(g, s * 0.38, -s * 0.38, -s * 0.38, s * 0.38, w * 1.3);
      break;
    case 'bite':
      g.beginPath();
      g.arc(0, -s * 0.05, s * 0.4, Math.PI, 0);
      stroke(g, w);
      for (const x of [-0.22, 0, 0.22]) {
        g.beginPath();
        g.moveTo(x * s - s * 0.09, -s * 0.05);
        g.lineTo(x * s, s * 0.32);
        g.lineTo(x * s + s * 0.09, -s * 0.05);
        g.fill();
      }
      break;
    case 'gore':
      g.beginPath();
      g.moveTo(-s * 0.4, s * 0.4);
      g.quadraticCurveTo(-s * 0.3, -s * 0.3, s * 0.42, -s * 0.42);
      g.quadraticCurveTo(-s * 0.02, -s * 0.05, -s * 0.12, s * 0.4);
      g.closePath();
      g.fill();
      break;
    case 'slam':
      g.beginPath();
      g.roundRect(-s * 0.34, -s * 0.28, s * 0.68, s * 0.56, s * 0.14);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(-s * 0.34 + i * s * 0.17, -s * 0.28);
        g.lineTo(-s * 0.34 + i * s * 0.17, -s * 0.02);
        stroke(g, w * 0.6);
      }
      break;
    case 'quake':
      g.beginPath();
      g.moveTo(-s * 0.45, -s * 0.05);
      g.lineTo(-s * 0.2, -s * 0.35);
      g.lineTo(0, s * 0.05);
      g.lineTo(s * 0.2, -s * 0.3);
      g.lineTo(s * 0.45, 0);
      stroke(g, w);
      g.fillRect(-s * 0.45, s * 0.25, s * 0.9, s * 0.12);
      break;
    case 'breath':
      flame(g, 0, 0, s);
      break;
    case 'inferno':
      flame(g, -s * 0.18, s * 0.05, s * 0.75);
      flame(g, s * 0.2, -s * 0.02, s * 0.9);
      break;
    case 'power':
      g.beginPath();
      g.moveTo(0, -s * 0.45);
      g.lineTo(s * 0.38, 0);
      g.lineTo(s * 0.14, 0);
      g.lineTo(s * 0.14, s * 0.42);
      g.lineTo(-s * 0.14, s * 0.42);
      g.lineTo(-s * 0.14, 0);
      g.lineTo(-s * 0.38, 0);
      g.closePath();
      g.fill();
      break;
    case 'quick':
      g.beginPath();
      g.moveTo(s * 0.1, -s * 0.48);
      g.lineTo(-s * 0.3, s * 0.06);
      g.lineTo(-s * 0.02, s * 0.06);
      g.lineTo(-s * 0.12, s * 0.48);
      g.lineTo(s * 0.32, -s * 0.08);
      g.lineTo(s * 0.04, -s * 0.08);
      g.closePath();
      g.fill();
      break;
    case 'shield':
      g.beginPath();
      g.moveTo(0, -s * 0.45);
      g.lineTo(s * 0.38, -s * 0.3);
      g.quadraticCurveTo(s * 0.36, s * 0.25, 0, s * 0.46);
      g.quadraticCurveTo(-s * 0.36, s * 0.25, -s * 0.38, -s * 0.3);
      g.closePath();
      g.fill();
      break;
    case 't_head':
      g.beginPath();
      g.arc(0, 0, s * 0.38, 0, Math.PI * 2);
      stroke(g, w);
      g.beginPath();
      g.arc(-s * 0.13, -s * 0.04, s * 0.07, 0, Math.PI * 2);
      g.arc(s * 0.13, -s * 0.04, s * 0.07, 0, Math.PI * 2);
      g.fill();
      break;
    case 't_limbs':
      g.beginPath();
      g.moveTo(-s * 0.38, -s * 0.3);
      g.lineTo(0, -s * 0.05);
      g.lineTo(-s * 0.1, s * 0.38);
      stroke(g, w * 1.4);
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(-s * 0.1, s * 0.38);
        g.lineTo(-s * 0.1 + i * s * 0.16 + s * 0.12, s * 0.46);
        stroke(g, w * 0.8);
      }
      break;
    case 't_legs':
      for (const x of [-0.16, 0.16]) {
        g.fillRect(x * s - s * 0.07, -s * 0.38, s * 0.14, s * 0.66);
        g.fillRect(x * s - s * 0.07, s * 0.24, s * 0.22, s * 0.12);
      }
      break;
    case 't_aux':
      g.beginPath();
      g.moveTo(-s * 0.4, s * 0.2);
      g.bezierCurveTo(-s * 0.1, s * 0.45, s * 0.45, s * 0.2, s * 0.2, -s * 0.15);
      g.bezierCurveTo(s * 0.05, -s * 0.38, -s * 0.2, -s * 0.2, -s * 0.05, -s * 0.02);
      stroke(g, w);
      break;
    case 't_body':
      g.beginPath();
      g.roundRect(-s * 0.36, -s * 0.24, s * 0.72, s * 0.48, s * 0.16);
      stroke(g, w);
      break;
    default:
      g.beginPath();
      g.arc(0, 0, s * 0.06, 0, Math.PI * 2);
      g.globalAlpha *= 0.4;
      g.fill();
  }
  g.restore();
}
