import Phaser from 'phaser';
import { Button, PIXEL_RATIO, Sfx } from 'dig-kit';
import { LEVELS } from '../game/levels';
import { type RuleOptions, applyTap, canRun, initialState, isCleared, trainAt, trainsLeft } from '../game/rules';
import { solve } from '../game/solver';
import { type Dir, type Level, type State, type TapEvent } from '../game/types';
import { type Intent, IntentBus, bindKeyboard, bindPointer } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { TrainView, bakeCar } from '../render/train';
import { drawYard } from '../render/yard';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

export const SAVE_KEY = 'densha-domino:save:v1';
export const runtime = { goto: 1, apply: false };

interface Save {
  v: 1;
  level: number;
  stars: number[];
}

/** Tutorial captions by level (index 0 to 2), then by tap number. Later levels have none. */
const COACH: Record<number, string[]> = {
  0: ['Tap the train. It runs along its track until it leaves the board.'],
  1: ['Tap the back train. It bumps the one ahead, which takes off too, and the back one follows it out.'],
  2: ['A bump on the side sets a train off as well. It runs away from the bump.', 'Fewer taps means more stars. Par is the fewest possible.'],
};

const BOARD_TOP = 120;
const BOARD_BOTTOM = 690;
const BOARD_W = WIDTH - 40;

type Phase = 'play' | 'animating' | 'won' | 'failed' | 'menu';

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private sfx!: Sfx;
  private save: Save = { v: 1, level: 0, stars: [] };
  private levelIndex = 0;
  private level!: Level;
  private state: State = [];
  private par = 0;
  private limit = 0;
  private taps = 0;
  private phase: Phase = 'play';
  private cs = 0;
  private ox = 0;
  private oy = 0;
  private views = new Map<number, TrainView>();
  private yard!: Phaser.GameObjects.Graphics;
  private arrows!: Phaser.GameObjects.Graphics;
  private pending: { train: number; dirs: Dir[] } | null = null;
  private cursor = { c: 0, r: 0 };
  private cursorOn = false;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private hudLevel!: Phaser.GameObjects.Text;
  private hudTaps!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private coach!: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Container | null = null;
  private starsG!: Phaser.GameObjects.Graphics;
  private gBackdrop!: Phaser.GameObjects.Graphics;
  private cursorG!: Phaser.GameObjects.Graphics;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private restartBtn!: Button;
  private levelsBtn!: Button;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private hold = false;
  private timers: Phaser.Time.TimerEvent[] = [];
  private playToken = 0;
  private testSlow = 1;
  private rules: RuleOptions = { followAfterSide: true };

  constructor() {
    super('game');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);
    this.sfx = new Sfx(this, {
      volume: () => tune.feel.volume,
      pitchStep: () => tune.feel.pitchStepPerLink,
      pitchStepMax: () => tune.feel.pitchStepMax,
    });

    this.gBackdrop = this.add.graphics().setDepth(-10);
    this.gBackdrop.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xdff6e6, 0xdff6e6, 1);
    this.gBackdrop.fillRect(0, 0, WIDTH, HEIGHT);
    this.gBackdrop.fillStyle(0xffffff, 0.35);
    for (const [x, y, r] of [[70, 70, 30], [320, 50, 22], [330, 760, 36], [50, 780, 26]]) this.gBackdrop.fillCircle(x, y, r);

    const px = this.make.graphics({ x: 0, y: 0 }, false);
    px.fillStyle(0xffffff, 1);
    px.fillRect(0, 0, 4, 4);
    px.generateTexture('px', 4, 4);
    px.destroy();
    this.sparks = this.add
      .particles(0, 0, 'px', {
        emitting: false,
        lifespan: { min: 260, max: 520 },
        speed: { min: 30, max: 160 },
        angle: { min: 0, max: 360 },
        gravityY: 120,
        scale: { start: 1.8, end: 0 },
        alpha: { start: 1, end: 0.1 },
      })
      .setDepth(220);

    this.add.text(5, 4, VERSION_STAMP, { fontFamily: 'monospace', fontSize: '8px', color: '#1f4f8f', resolution: PIXEL_RATIO }).setAlpha(0.35).setDepth(250);
    this.hudLevel = this.hudText(WIDTH / 2, 34, 24, '#ffffff');
    this.hudTaps = this.hudText(WIDTH / 2, 70, 15, '#f1f9ff');
    this.starsG = this.add.graphics().setDepth(240);
    this.banner = this.hudText(WIDTH / 2, 400, 34, '#ffe27a').setDepth(230).setAlpha(0);
    this.coach = this.hudText(WIDTH / 2, 172, 16, '#ffffff').setDepth(230).setAlign('center').setWordWrapWidth(WIDTH - 50);
    this.yard = this.add.graphics().setDepth(0);
    this.arrows = this.add.graphics().setDepth(60);
    this.cursorG = this.add.graphics().setDepth(70);

    this.restartBtn = new Button(this, 105, 760, 170, 54, 'Restart', null, { fill: 0x3a4a68, edge: 0x6f9cff }, () => this.bus.emit({ type: 'restart' }), 20);
    this.levelsBtn = new Button(this, 285, 760, 170, 54, 'Levels', null, { fill: 0x5a3f2e, edge: 0xffa05c }, () => this.bus.emit({ type: 'levels' }), 20);

    this.bus.on((i) => this.onIntent(i));
    bindKeyboard(this, this.bus);
    bindPointer(this, this.bus, () => tune.feel.swipePx);
    this.input.on('pointerdown', () => (this.hold = true));
    this.input.on('pointerup', () => (this.hold = false));
    this.input.on('pointerupoutside', () => (this.hold = false));

    this.loadSave();
    this.startLevel(this.save.level);

    if (new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__densha = {
        level: () => this.levelIndex,
        phase: () => this.phase,
        taps: () => this.taps,
        par: () => this.par,
        left: () => trainsLeft(this.state),
        /** Next tap of an optimal solution from the current state, as a pixel position and direction. */
        nextMove: () => {
          const sol = solve(this.level, this.state, 400000, this.rules);
          const m = sol.moves[0];
          if (!m) return null;
          const v = this.views.get(m.train)!;
          return { x: v.container.x, y: v.container.y, dir: m.dir, axis: this.level.trains[m.train].axis };
        },
        goto: (n: number) => this.startLevel(n),
        menuOpen: () => this.phase === 'menu',
        coach: () => this.coach.text,
        hintShown: () => !!this.hint,
        slow: (s: number) => (this.testSlow = s),
        levels: () => LEVELS.length,
      };
    }
  }

  // ------------------------------------------------------------- save / load

  private loadSave(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Save;
        if (s.v === 1) this.save = s;
      }
    } catch {
      /* storage unavailable */
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* storage unavailable: play on without saving */
    }
  }

  // ------------------------------------------------------------------ level

  private hudText(x: number, y: number, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, '', { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: `${size}px`, color, stroke: '#1f4f8f', strokeThickness: Math.max(2, size / 6), align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(240);
  }

  private startLevel(index: number): void {
    this.levelIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    // Drop anything still scheduled from the previous round so it cannot move the new trains.
    this.playToken++;
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.clearOverlay();
    this.closeMenu();
    this.pending = null;
    this.arrows.clear();
    this.state = initialState(this.level);
    this.taps = 0;
    this.phase = 'play';
    // Rules come from tune.json; par is solved under the same rules so stars stay honest.
    this.rules = { followAfterSide: !!tune.rules.followAfterSide };
    this.par = solve(this.level, initialState(this.level), 400000, this.rules).par;
    this.limit = this.par + tune.rules.limitSlack;
    this.save.level = this.levelIndex;
    this.persist();

    this.cs = Math.floor(Math.min(BOARD_W / this.level.cols, (BOARD_BOTTOM - BOARD_TOP) / this.level.rows));
    this.ox = Math.round((WIDTH - this.cs * this.level.cols) / 2);
    this.oy = Math.round(BOARD_TOP + (BOARD_BOTTOM - BOARD_TOP - this.cs * this.level.rows) / 2);
    this.yard.clear();
    drawYard(this.yard, this.level, { cs: this.cs, ox: this.ox, oy: this.oy });
    for (const t of this.level.trains) {
      bakeCar(this, t.color, this.cs);
      const v = new TrainView(this, t, this.cs);
      const c = v.centre(t.start, this.ox, this.oy);
      v.container.setPosition(c.x, c.y).setDepth(10 + t.id);
      this.views.set(t.id, v);
    }
    this.cursor = { c: 0, r: 0 };
    this.refreshHud();
    this.updateCoach();
  }

  private refreshHud(): void {
    this.hudLevel.setText(`LEVEL ${this.levelIndex + 1}`);
    this.hudTaps.setText(`${this.level.name}   |   Taps ${this.taps} / ${this.limit}   |   Par ${this.par}`);
    const g = this.starsG;
    g.clear();
    const stars = this.starsFor(this.taps);
    for (let i = 0; i < 3; i++) this.drawStar(g, WIDTH / 2 + (i - 1) * 34, 100, 11, i < stars ? 0xffd04a : 0x6f8db5);
  }

  private starsFor(taps: number): number {
    return taps <= this.par ? 3 : taps <= this.par + tune.rules.starSlack ? 2 : 1;
  }

  private drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    g.fillStyle(0x1f4f8f, 1);
    g.fillPoints(pts.map((p) => ({ x: p.x, y: p.y + 1.5 })), true);
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
  }

  // ----------------------------------------------------------------- intents

  /** The train under a point, or -1. */
  private locate(x: number, y: number): number {
    const c = Math.floor((x - this.ox) / this.cs);
    const r = Math.floor((y - this.oy) / this.cs);
    if (c < 0 || r < 0 || c >= this.level.cols || r >= this.level.rows) return -1;
    return trainAt(this.level, this.state, c, r);
  }

  /** Centre of the arrow button for a direction, for the train waiting on a direction pick. */
  private arrowPos(train: number, d: Dir): { x: number; y: number } {
    const t = this.level.trains[train];
    const v = this.views.get(train)!;
    const c = v.centre(this.state[train], this.ox, this.oy);
    const half = (t.len * this.cs) / 2 + this.cs * 0.55;
    return { x: c.x + (t.axis === 'h' ? d * half : 0), y: c.y + (t.axis === 'v' ? d * half : 0) };
  }

  private onIntent(intent: Intent): void {
    if (intent.type === 'restart') return this.startLevel(this.levelIndex);
    if (intent.type === 'next') return this.startLevel(this.levelIndex + 1);
    if (intent.type === 'levels') return this.phase === 'menu' ? (this.closeMenu(), this.updateCoach()) : this.phase === 'play' ? ((this.menuPage = -1), this.openMenu()) : undefined;
    if (intent.type === 'select') return this.selectLevel(intent.level);
    if (this.phase !== 'play') return;
    if (intent.type === 'tap') {
      if (this.pending) {
        for (const d of this.pending.dirs) {
          const a = this.arrowPos(this.pending.train, d);
          if (Math.hypot(intent.x - a.x, intent.y - a.y) < 30) return this.runTrain(this.pending.train, d);
        }
      }
      const t = this.locate(intent.x, intent.y);
      if (t >= 0) return this.tapTrain(t);
      this.pending = null;
      this.arrows.clear();
      return;
    }
    if (intent.type === 'swipe') {
      const t = this.locate(intent.x, intent.y);
      if (t < 0) return;
      const along = this.level.trains[t].axis === 'h' ? intent.dx : intent.dy;
      return this.runTrain(t, along > 0 ? 1 : -1);
    }
    if (intent.type === 'tapTrain') return this.tapTrain(intent.train);
    if (intent.type === 'run') return this.runTrain(intent.train, intent.dir);
    if (intent.type === 'arrow') {
      if (this.pending) {
        const horizontal = this.level.trains[this.pending.train].axis === 'h';
        const dir = horizontal ? intent.dc : intent.dr;
        if (dir && this.pending.dirs.includes(dir as Dir)) return this.runTrain(this.pending.train, dir as Dir);
      }
      this.cursorOn = true;
      this.cursor = {
        c: Phaser.Math.Clamp(this.cursor.c + intent.dc, 0, this.level.cols - 1),
        r: Phaser.Math.Clamp(this.cursor.r + intent.dr, 0, this.level.rows - 1),
      };
      this.drawCursor();
      return;
    }
    if (intent.type === 'confirm') {
      const t = trainAt(this.level, this.state, this.cursor.c, this.cursor.r);
      if (t >= 0) this.tapTrain(t);
    }
  }

  private drawCursor(): void {
    const g = this.cursorG;
    g.clear();
    if (!this.cursorOn) return;
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeRoundedRect(this.ox + this.cursor.c * this.cs + 2, this.oy + this.cursor.r * this.cs + 2, this.cs - 4, this.cs - 4, 8);
  }

  /** A tap on a train: run it if only one way is open, show two arrows if both are, shake if it is stuck. */
  private tapTrain(train: number): void {
    const dirs = ([-1, 1] as Dir[]).filter((d) => canRun(this.level, this.state, train, d));
    this.pending = null;
    this.arrows.clear();
    if (dirs.length === 0) {
      this.sfx.tone(170, 0.07, 'square', 0.14, 120);
      const v = this.views.get(train)!;
      const x = v.container.x;
      const y = v.container.y;
      this.tweens.add({ targets: v.container, x: x + 3, duration: 40, yoyo: true, repeat: 2, onComplete: () => v.container.setPosition(x, y) });
      return;
    }
    if (dirs.length === 1) return this.runTrain(train, dirs[0]);
    this.sfx.uiTap();
    this.pending = { train, dirs };
    this.showArrows(train);
  }

  private showArrows(train: number): void {
    const t = this.level.trains[train];
    const g = this.arrows;
    g.clear();
    for (const d of [-1, 1] as Dir[]) {
      const { x, y } = this.arrowPos(train, d);
      g.fillStyle(0x1f4f8f, 0.9);
      g.fillCircle(x, y + 2, 20);
      g.fillStyle(0xffd04a, 1);
      g.fillCircle(x, y, 19);
      g.fillStyle(0x1f4f8f, 1);
      const a = 8;
      if (t.axis === 'h') g.fillTriangle(x + d * a, y, x - d * a * 0.6, y - a, x - d * a * 0.6, y + a);
      else g.fillTriangle(x, y + d * a, x - a, y - d * a * 0.6, x + a, y - d * a * 0.6);
    }
  }

  // ------------------------------------------------------------------- run

  private runTrain(train: number, dir: Dir): void {
    if (!canRun(this.level, this.state, train, dir)) return this.tapTrain(train);
    this.pending = null;
    this.arrows.clear();
    this.clearHint();
    const res = applyTap(this.level, this.state, { train, dir }, this.rules);
    this.taps++;
    this.state = res.state;
    this.phase = 'animating';
    this.refreshHud();
    this.play(res.events, res.links);
  }

  // ------------------------------------------------------------- animation

  /** Beat length for the k-th train in a chain: later links play faster, down to a floor. */
  private pace(link: number): number {
    return Math.max(tune.feel.chainFloor, Math.pow(tune.feel.chainCompress, link - 1));
  }

  private runDuration(distCells: number, link: number): number {
    return (tune.feel.runBaseMs + tune.feel.runPerCellMs * distCells) * this.pace(link);
  }

  /** Lays the events out on a timeline: runs, then horn and spook beats, overlapping so chains stay quick. */
  private play(events: TapEvent[], links: number): void {
    const f = tune.feel;
    let cursor = 0;
    let lastRunStart = 0;
    let lastRunDur = 0;
    let exits = 0;
    const token = this.playToken;
    const at = (ms: number, fn: () => void) => {
      this.timers.push(this.time.delayedCall(Math.max(1, ms), () => token === this.playToken && fn()));
    };
    // Pixel position of each train as of the end of its last scheduled run.
    const pos = new Map<number, number>();
    for (const [id] of this.views) pos.set(id, this.level.trains[id].start);
    let combo = 0;

    events.forEach((e, idx) => {
      const nextE = events[idx + 1];
      if (e.type === 'run') {
        const v = this.views.get(e.train)!;
        const t = this.level.trains[e.train];
        const startPos = pos.get(e.train)!;
        const dist = Math.abs(e.to - startPos);
        const dur = this.runDuration(dist, e.link);
        const from = v.centre(startPos, this.ox, this.oy);
        const to = v.centre(e.to + (e.exited ? e.dir * f.exitExtraCells : 0), this.ox, this.oy);
        // A resumed run starts while the train ahead is still moving off.
        const start = e.resume && lastRunDur ? lastRunStart + lastRunDur * f.resumeOverlap : cursor;
        at(start, () => {
          this.sfx.noise(0.1, 0.18, 1800);
          this.tweens.add({
            targets: v.container,
            x: to.x,
            y: to.y,
            duration: dur,
            ease: e.exited ? 'Sine.In' : 'Cubic.In',
            onUpdate: undefined,
            onComplete: () => {
              if (e.exited) {
                this.sfx.treasure();
                this.sparks.particleTint = t.color;
                this.sparks.explode(10, Phaser.Math.Clamp(to.x, 20, WIDTH - 20), Phaser.Math.Clamp(to.y, 130, 700));
                v.destroy();
                this.views.delete(e.train);
              } else v.brake();
            },
          });
          if (e.exited) this.tweens.add({ targets: v.container, alpha: 0, delay: dur * 0.55, duration: dur * 0.45 });
          void from;
          void v.container.setPosition(from.x, from.y);
        });
        pos.set(e.train, e.exited ? e.to : e.to);
        lastRunStart = start;
        lastRunDur = dur;
        cursor = start + dur;
        if (e.exited) exits++;
        void nextE;
      } else {
        const runner = this.views.get(e.runner);
        const target = this.views.get(e.target);
        if (!runner || !target) return;
        const rt = this.level.trains[e.runner];
        const link = e.link;
        const beat = (e.spooked ? f.spookMs : f.hornMs * 0.6) * this.pace(link);
        const step = combo++;
        at(cursor, () => {
          this.horn(runner, rt.axis, e.dir, step, e.sameLine);
          if (e.spooked) this.spook(target, beat);
          else this.bonk(target);
        });
        cursor += beat;
        lastRunDur = 0;
      }
    });

    at(cursor + 60, () => this.afterPlay(links, exits));
  }

  private horn(runner: TrainView, axis: 'h' | 'v', dir: Dir, step: number, sameLine: boolean): void {
    const f = tune.feel;
    runner.brake();
    // Two-note electric horn, rising a little with each link.
    const p = Math.pow(2, Math.min(step, f.pitchStepMax) * f.pitchStepPerLink);
    this.sfx.tone(392 * p, 0.14, 'square', 0.13);
    this.sfx.tone(494 * p, 0.14, 'square', 0.11, undefined, 0.01);
    const frontX = runner.container.x + (axis === 'h' ? dir * ((runner.def.len * this.cs) / 2 + 4) : 0);
    const frontY = runner.container.y + (axis === 'v' ? dir * ((runner.def.len * this.cs) / 2 + 4) : 0);
    const g = this.add.graphics({ x: frontX, y: frontY }).setDepth(200);
    g.setRotation(axis === 'h' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.lineStyle(4, 0xffffff, 1);
    for (let i = 0; i < f.hornRings; i++) {
      const r = 10 + i * (f.hornRingPx / f.hornRings);
      g.beginPath();
      g.arc(0, 0, r, -0.75, 0.75);
      g.strokePath();
    }
    g.setScale(0.5);
    this.tweens.add({ targets: g, scale: 1.5, alpha: 0, duration: f.hornMs * 2, ease: 'Cubic.Out', onComplete: () => g.destroy() });
    this.sparks.particleTint = 0xffffff;
    this.sparks.explode(f.hornPuffs, frontX, frontY);
    if (!sameLine) return;
  }

  /** The hit train is startled: stretches, skews and shakes, then springs away. */
  private spook(v: TrainView, beatMs: number): void {
    const f = tune.feel;
    const prog = { k: 0 };
    this.tweens.add({
      targets: prog,
      k: 1,
      duration: beatMs,
      ease: 'Sine.Out',
      onUpdate: () => {
        v.pose(prog.k, f.spookStretch, f.spookSquash, f.spookSkewPx, f.spookTiltDeg);
        v.container.x += (Math.random() - 0.5) * 2 * f.spookShakePx * prog.k;
      },
      onComplete: () => {
        // Release into the run: springs back while it starts to move.
        this.tweens.add({ targets: prog, k: 0, duration: f.spookReleaseMs, ease: 'Back.Out', onUpdate: () => v.pose(prog.k, f.spookStretch, f.spookSquash, f.spookSkewPx, f.spookTiltDeg), onComplete: () => v.rest() });
      },
    });
    const bang = this.add
      .text(v.container.x, v.container.y - this.cs * 0.6, '!', { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '30px', color: '#ffcf3a', stroke: '#7a3a00', strokeThickness: 5, resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(210)
      .setScale(0.3);
    this.tweens.add({ targets: bang, scale: 1.1, duration: f.bangPopMs * 0.4, ease: 'Back.Out' });
    this.tweens.add({ targets: bang, alpha: 0, y: bang.y - 10, delay: f.bangPopMs * 0.5, duration: f.bangPopMs * 0.5, onComplete: () => bang.destroy() });
  }

  /** A hit train that does not move (crossing track or boxed in) just takes the bump. */
  private bonk(v: TrainView): void {
    const x = v.container.x;
    this.tweens.add({ targets: v.container, x: x + 3, duration: 40, yoyo: true, repeat: 2, onComplete: () => (v.container.x = x) });
  }

  private afterPlay(links: number, exits: number): void {
    void exits;
    if (links >= tune.feel.bigChainTrains) {
      this.sfx.cleared();
      this.cameras.main.shake(tune.feel.shakeMs, tune.feel.shakeIntensity);
      this.punchZoom(tune.feel.punchZoom);
      this.say(`CHAIN x${links}`);
      if (navigator.vibrate && tune.feel.vibrate) navigator.vibrate(15);
    }
    if (isCleared(this.state)) return this.win();
    if (this.taps >= this.limit) return this.fail();
    this.phase = 'play';
    this.updateCoach();
  }

  // ------------------------------------------------------------ tutorial

  private clearHint(): void {
    this.hint?.destroy();
    this.hint = null;
  }

  /**
   * Guided tutorial for levels 1 to 3: a caption plus a pulsing ring and arrow on the train
   * an optimal solution taps next. It is only a hint: it never blocks or swallows input.
   */
  private updateCoach(): void {
    this.clearHint();
    const lines = COACH[this.levelIndex];
    if (!lines || this.phase !== 'play') {
      this.coach.setText('');
      return;
    }
    this.coach.setText(lines[Math.min(this.taps, lines.length - 1)]);
    const m = solve(this.level, this.state, 400000, this.rules).moves[0];
    const v = m ? this.views.get(m.train) : undefined;
    if (!m || !v) return;
    const horizontal = this.level.trains[m.train].axis === 'h';
    const a = this.arrowPos(m.train, m.dir);
    const g = this.add.graphics();
    g.lineStyle(4, 0xffe27a, 1);
    g.strokeRoundedRect(-this.cs * 0.6 * (horizontal ? this.level.trains[m.train].len : 1), -this.cs * 0.6 * (horizontal ? 1 : this.level.trains[m.train].len), this.cs * 1.2 * (horizontal ? this.level.trains[m.train].len : 1), this.cs * 1.2 * (horizontal ? 1 : this.level.trains[m.train].len), 14);
    const ring = this.add.container(v.container.x, v.container.y, [g]).setDepth(220);
    const arrow = this.add.graphics().setDepth(221);
    arrow.fillStyle(0xffe27a, 1);
    const k = this.cs * 0.28;
    if (horizontal) arrow.fillTriangle(m.dir * k, 0, -m.dir * k * 0.5, -k, -m.dir * k * 0.5, k);
    else arrow.fillTriangle(0, m.dir * k, -k, -m.dir * k * 0.5, k, -m.dir * k * 0.5);
    const holder = this.add.container(0, 0, [ring, arrow]).setDepth(220);
    arrow.setPosition(a.x, a.y);
    this.tweens.add({ targets: ring, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: arrow, x: a.x + (horizontal ? m.dir * 8 : 0), y: a.y + (horizontal ? 0 : m.dir * 8), duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.hint = holder;
  }

  // ---------------------------------------------------------------- results

  private win(): void {
    this.phase = 'won';
    const stars = this.starsFor(this.taps);
    this.save.stars[this.levelIndex] = Math.max(this.save.stars[this.levelIndex] ?? 0, stars);
    this.save.level = Math.min(this.levelIndex + 1, LEVELS.length - 1);
    this.persist();
    this.sfx.cleared();
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 110, () => {
      this.sparks.particleTint = [0xffd04a, 0xff6fb5, 0x4d9bff, 0x5ed957][i];
      this.sparks.explode(18, 60 + Math.random() * 270, 200 + Math.random() * 300);
    });
    this.showOverlay(`Level ${this.levelIndex + 1} clear!`, stars, this.levelIndex < LEVELS.length - 1 ? 'Next level' : 'Play again', () => this.bus.emit({ type: this.levelIndex < LEVELS.length - 1 ? 'next' : 'restart' }));
  }

  private fail(): void {
    this.phase = 'failed';
    this.sfx.miss();
    this.showOverlay('Out of taps', 0, 'Try again', () => this.bus.emit({ type: 'restart' }));
  }

  private clearOverlay(): void {
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
  }

  private showOverlay(title: string, stars: number, label: string, onTap: () => void): void {
    this.clearHint();
    this.coach.setText('');
    this.clearOverlay();
    const panel = this.add.graphics().setDepth(300);
    panel.fillStyle(0x1f4f8f, 0.55);
    panel.fillRect(0, 0, WIDTH, HEIGHT);
    panel.fillStyle(0x000000, 0.25);
    panel.fillRoundedRect(46, 268, WIDTH - 92, 280, 26);
    panel.fillStyle(0xfff8e6, 1);
    panel.fillRoundedRect(46, 260, WIDTH - 92, 280, 26);
    const t = this.hudText(WIDTH / 2, 310, 28, '#ffffff').setDepth(310);
    t.setText(title);
    const g = this.add.graphics().setDepth(310);
    if (stars > 0) for (let i = 0; i < 3; i++) this.drawStar(g, WIDTH / 2 + (i - 1) * 62, 390, 26, i < stars ? 0xffd04a : 0xc9c2b0);
    else this.hudText(WIDTH / 2, 390, 15, '#ffffff').setDepth(310).setText(`Par is ${this.par} taps. You used ${this.taps}.`);
    const b = new Button(this, WIDTH / 2, 480, 220, 60, label, null, { fill: 0x2f9e5b, edge: 0x6dffa8 }, onTap, 22);
    b.container.setDepth(310);
    this.overlay.push(panel, t, g, b.container);
  }

  // ------------------------------------------------------------ level selector

  private isUnlocked(i: number): boolean {
    if (tune.rules.unlockAll) return true;
    const cleared = this.save.stars.reduce((best, st, idx) => (st > 0 ? Math.max(best, idx) : best), -1);
    return i <= cleared + 1;
  }

  private selectLevel(i: number): void {
    if (i < 0 || i >= LEVELS.length) return;
    if (!this.isUnlocked(i)) {
      this.sfx.miss();
      return;
    }
    this.sfx.uiTap();
    this.startLevel(i);
  }

  private closeMenu(): void {
    this.menu.forEach((o) => o.destroy());
    this.menu = [];
    if (this.phase === 'menu') this.phase = 'play';
  }

  /** A grid of levels with the stars earned so far. */
  private menuPage = -1;

  private openMenu(): void {
    this.closeMenu();
    this.phase = 'menu';
    this.pending = null;
    this.arrows.clear();
    this.sfx.uiTap();
    const cols = 5;
    const cell = 56;
    const gap = 8;
    const perPage = 20;
    const pages = Math.ceil(LEVELS.length / perPage);
    if (this.menuPage < 0) this.menuPage = Math.floor(this.levelIndex / perPage);
    this.menuPage = Phaser.Math.Clamp(this.menuPage, 0, pages - 1);
    const first = this.menuPage * perPage;
    const rows = Math.ceil(Math.min(perPage, LEVELS.length - first) / cols);
    const gridW = cols * cell + (cols - 1) * gap;
    const rowH = cell + 30;
    const panelW = WIDTH - 50;
    const panelH = 120 + rows * rowH + 70;
    const px = (WIDTH - panelW) / 2;
    const py = Math.round((HEIGHT - panelH) / 2) - 30;
    const dim = this.add.graphics().setDepth(300);
    dim.fillStyle(0x1f4f8f, 0.55);
    dim.fillRect(0, 0, WIDTH, HEIGHT);
    dim.fillStyle(0x000000, 0.25);
    dim.fillRoundedRect(px, py + 8, panelW, panelH, 26);
    dim.fillStyle(0xfff8e6, 1);
    dim.fillRoundedRect(px, py, panelW, panelH, 26);
    // Tapping the dimmed area outside the panel closes the menu.
    const zone = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0).setDepth(299).setInteractive();
    zone.on('pointerdown', () => this.bus.emit({ type: 'levels' }));
    const title = this.hudText(WIDTH / 2, py + 40, 28, '#ffffff').setDepth(310);
    title.setText(pages > 1 ? `Select level (${this.menuPage + 1}/${pages})` : 'Select level');
    const stars = this.add.graphics().setDepth(311);
    this.menu.push(zone, dim, title, stars);
    LEVELS.slice(first, first + perPage).forEach((lv, k0) => {
      const i = first + k0;
      const c = k0 % cols;
      const r = Math.floor(k0 / cols);
      const x = (WIDTH - gridW) / 2 + c * (cell + gap) + cell / 2;
      const y = py + 100 + r * rowH + cell / 2;
      const open = this.isUnlocked(i);
      const here = i === this.levelIndex;
      const b = new Button(this, x, y, cell, cell, String(i + 1), null, open ? { fill: here ? 0x2f9e5b : 0x3a4a68, edge: here ? 0x6dffa8 : 0x6f9cff } : { fill: 0x8a8fa0, edge: 0xb7bccb }, () => this.bus.emit({ type: 'select', level: i }), 22);
      b.container.setDepth(310);
      if (!open) b.container.setAlpha(0.6);
      this.menu.push(b.container);
      const got = this.save.stars[i] ?? 0;
      for (let k = 0; k < 3; k++) this.drawStar(stars, x + (k - 1) * 17, y + cell / 2 + 14, 7, k < got ? 0xffd04a : 0xc9c2b0);
      void lv;
    });
    if (pages > 1) {
      const page = (d: number) => () => {
        this.menuPage = (this.menuPage + d + pages) % pages;
        this.openMenu();
      };
      for (const [d, label, x] of [[-1, '<', px + 50], [1, '>', px + panelW - 50]] as const) {
        const pb = new Button(this, x, py + panelH - 40, 56, 48, label, null, { fill: 0x3a4a68, edge: 0x6f9cff }, page(d), 22);
        pb.container.setDepth(310);
        this.menu.push(pb.container);
      }
    }
    const close = new Button(this, WIDTH / 2, py + panelH - 40, 160, 48, 'Close', null, { fill: 0x2f9e5b, edge: 0x6dffa8 }, () => this.bus.emit({ type: 'levels' }), 20);
    close.container.setDepth(310);
    this.menu.push(close.container);
  }

  // -------------------------------------------------------------------- fx

  private punchZoom(mult: number): void {
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(PIXEL_RATIO);
    this.tweens.add({ targets: cam, zoom: PIXEL_RATIO * mult, duration: 70, yoyo: true, ease: 'Sine.Out' });
  }

  private say(text: string): void {
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 300 });
  }

  update(): void {
    if (runtime.apply) {
      runtime.apply = false;
      this.startLevel(runtime.goto - 1);
    }
    // Holding a finger down during a chain speeds it up.
    const speed = (this.phase === 'animating' && this.hold ? tune.feel.holdSpeed : 1) * this.testSlow;
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
  }
}
