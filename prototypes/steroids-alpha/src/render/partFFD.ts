import Phaser from 'phaser';
import type { RigModule, Pose } from './shipRig';
import { panelRelief, projectTiltPoint } from './shipTilt';
import type { TiltBasis } from './shipTilt';

// Panel hardlines from the approved lab, rather than an evenly spaced rubber sheet.
const US = [0, .22, .5, .78, 1], VS = [0, .2, .45, .75, 1];

/** One persistent mesh beside its original sprite. No texture baking or per-frame GPU allocation. */
export class PartFFD {
  private mesh: Phaser.GameObjects.Mesh | null = null;
  private samples: { u: number; v: number; z: number; x: number; y: number }[] = [];
  private links: { vertex: Phaser.Geom.Mesh.Vertex; sample: number }[] = [];
  private lastTint = -1;

  constructor(private scene: Phaser.Scene, private container: Phaser.GameObjects.Container, private m: RigModule, private image: Phaser.GameObjects.Image) {}

  ensure(): boolean {
    if (this.mesh) return true;
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (const v of VS) for (const u of US) {
      positions.push(u, v); uvs.push(this.m.mirror ? 1 - u : u, v);
      this.samples.push({ u, v, z: panelRelief(this.m, u, v), x: 0, y: 0 });
    }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const q = j * 5 + i; indices.push(q, q + 5, q + 1, q + 1, q + 5, q + 6);
    }
    const mesh = this.scene.add.mesh(0, 0, this.image.texture.key, undefined, positions, uvs, indices).setActive(false).setVisible(false);
    this.mesh = mesh;
    mesh.hideCCW = false;
    this.container.addAt(mesh, this.container.getIndex(this.image) + 1);
    const nearest = (xs: number[], x: number): number => xs.reduce((best, n, i) => Math.abs(n - x) < Math.abs(xs[best] - x) ? i : best, 0);
    this.links = mesh.vertices.map(vertex => ({ vertex, sample: nearest(VS, vertex.v) * 5 + nearest(US, this.m.mirror ? 1 - vertex.u : vertex.u) }));
    return true;
  }

  show(active: boolean): void { this.image.setVisible(!active); this.mesh?.setVisible(active); }

  destroy(): void { this.mesh?.destroy(); this.mesh = null; this.links = []; this.samples = []; }

  draw(p: Pose, width: number, scaleX: number, scaleY: number, hover: number, tilt: TiltBasis): void {
    const mesh = this.mesh!;
    const height = width * this.image.height / this.image.width;
    const c = Math.cos(p.rotation), s = Math.sin(p.rotation);
    for (const q of this.samples) {
      const x = (q.u - .5) * width * scaleX, y = (q.v - .5) * height * scaleY;
      projectTiltPoint(p.x + c * x - s * y, p.y + s * x + c * y, q.z, tilt, q);
      q.y -= hover;
    }
    const tint = this.image.tintTopLeft;
    for (const { vertex, sample } of this.links) {
      const q = this.samples[sample]; vertex.vx = q.x; vertex.vy = q.y; vertex.vz = 0;
      if (tint !== this.lastTint) vertex.color = tint;
    }
    this.lastTint = tint;
    mesh.setVisible(true);
  }
}
