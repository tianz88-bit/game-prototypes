import { createTitleArt } from '../render/titleArt';
import { GAME_FONT } from '../gameFont';
import Phaser from 'phaser';
import { Sfx } from 'dig-kit';
import {GameButton as Button} from '../uiButton';
import { PUZZLE_CONTRACTS } from '../game/puzzle-contracts';
import { LEVELS } from '../game/levels';
import { type RuleOptions, applyTap, canRun, initialState, isCleared, trainAt, trainsLeft } from '../game/rules';
import { solve } from '../game/solver';
import { type Dir, type Level, type State, type TapEvent } from '../game/types';
import { type Intent, IntentBus, bindKeyboard, bindPointer } from '../input/intents';
import { HEIGHT, WIDTH, PIXEL_RATIO } from '../pixelRatio';
import { TrainView,SIDE_BODY_LIFT } from '../render/train';
import { drawYard } from '../render/yard';
import {preloadArt,registerArt,hasArt} from '../render/art';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

export const SAVE_KEY = 'densha-domino:save:v2';
export const runtime = { goto: 1, apply: false, fps:60 };

interface Save {
  v: 2;
  level: number;
  stars: number[];
  tutorialEdition?: number;
  unlockAll?: boolean;
  records?: Record<string,{moves:number;chain:number}>;
}

/** Tutorial captions by level (index 0 to 2), then by tap number. Later levels have none. */
const COACH: Record<number, string[]> = {
  0: ['Send every train out through a tunnel. Swipe this one right.'],
  1: ['Swipe the back train right. It honks, the train ahead leaves, and yours follows.'],
  2: ['Swipe right. Watch the middle train go up when it hears the honk. Honked trains drive forward, toward their face.'],
  3: ['Swipe the highlighted train left to make room. You can swipe either way along its track.', 'Now swipe the highlighted train down. Watch how many trains leave from one swipe!'],
};

const BOARD_TOP = 120;
const BOARD_BOTTOM = 690;
const BOARD_W = WIDTH - 40;

type Phase = 'play' | 'animating' | 'won' | 'failed' | 'menu';

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private sfx!: Sfx;
  private save: Save = { v: 2, level: 0, stars: [], tutorialEdition: 2 };
  private visualState:State=[];
  private yardArt:Phaser.GameObjects.GameObject[]=[];
  private trainMasks:Phaser.Display.Masks.GeometryMask[]=[];
  private trainLayer:Phaser.GameObjects.Container|null=null;
  private frontRowLayer:Phaser.GameObjects.Container|null=null;
  private readyStateKey='';
  private exitAudit:object[]|null=null;
  private alternatePars=new Map<Level,number>();
  private levelIndex = 0;
  private level!: Level;
  private state: State = [];
  private par = 0;
  private limit = 0;
  private titleOpen=false;
  private longestChain=0;
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
  private comboArt?: Phaser.GameObjects.Container;
  private banner!: Phaser.GameObjects.Text;
  private coach!: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Container | null = null;
  private starsG!: Phaser.GameObjects.Graphics;
  private gBackdrop!: Phaser.GameObjects.Graphics;
  private cursorG!: Phaser.GameObjects.Graphics;
  private goalBalls!:Phaser.GameObjects.Particles.ParticleEmitter;
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

  preload():void {preloadArt(this);}

  create(): void {
    registerArt(this);
    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);
    this.sfx = new Sfx(this, {
      volume: () => tune.feel.volume,
      pitchStep: () => tune.feel.pitchStepPerLink,
      pitchStepMax: () => tune.feel.pitchStepMax,
    });

    this.gBackdrop = this.add.graphics().setDepth(-10);
    this.gBackdrop.fillGradientStyle(0xfff3e1, 0xfff3e1, 0xf6dfc5, 0xf6dfc5, 1);
    this.gBackdrop.fillRect(0, 0, WIDTH, HEIGHT);
    this.gBackdrop.fillStyle(0xffffff, 0.35);
    for (const [x, y, r] of [[70, 70, 30], [320, 50, 22], [330, 760, 36], [50, 780, 26]]) this.gBackdrop.fillCircle(x, y, r);

    const px = this.make.graphics({ x: 0, y: 0 }, false);
    px.fillStyle(0xffffff, 1);
    px.fillRect(0, 0, 4, 4);
    px.generateTexture('px', 4, 4);
    px.destroy();
    const orbKey='dd_goal_orb';
    if(!this.textures.exists(orbKey)){
      const texture=this.textures.createCanvas(orbKey,48,48)!;
      const ctx=texture.context,halo=ctx.createRadialGradient(24,24,0,24,24,24);
      halo.addColorStop(0,'#ffffd1');halo.addColorStop(.24,'#fff995');
      halo.addColorStop(.38,'#ffdf00');halo.addColorStop(.56,'rgba(255,216,0,.55)');
      halo.addColorStop(1,'rgba(255,216,0,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,48,48);texture.refresh();
    }
    this.goalBalls=this.add.particles(0,0,orbKey,{emitting:false,maxParticles:72,lifespan:{min:390,max:550},
      scale:{start:.43,end:.09},alpha:{start:1,end:0},speed:0}).setDepth(4);
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
    this.hudLevel = this.hudText(WIDTH / 2, 34, 24, '#74435c');
    this.hudTaps = this.hudText(WIDTH / 2, 70, 15, '#795a68');
    this.starsG = this.add.graphics().setDepth(240);
    this.banner = this.hudText(WIDTH / 2, 400, 34, '#ffe27a').setDepth(230).setAlpha(0);
    this.coach = this.hudText(WIDTH / 2, 172, 16, '#74435c').setDepth(230).setAlign('center').setWordWrapWidth(WIDTH - 50);
    this.yard = this.add.graphics().setDepth(0);
    this.arrows = this.add.graphics().setDepth(60);
    this.cursorG = this.add.graphics().setDepth(70);

    this.restartBtn = new Button(this, 105, 760, 170, 54, 'Restart', null, { fill: 0x8b416d, edge: 0xba7b9f }, () => this.bus.emit({ type: 'restart' }), 20);
    this.levelsBtn = new Button(this, 285, 760, 170, 54, 'Levels', null, { fill: 0x508067, edge: 0x9fc49c }, () => this.bus.emit({ type: 'levels' }), 20);
    this.restartBtn.container.setDepth(240);this.levelsBtn.container.setDepth(240);

    this.bus.on((i) => this.onIntent(i));
    bindKeyboard(this, this.bus);
    bindPointer(this, this.bus, () => tune.feel.swipePx);
    this.input.on('pointerdown', () => (this.hold = true));
    this.input.on('pointerup', () => (this.hold = false));
    this.input.on('pointerupoutside', () => (this.hold = false));

    this.loadSave();
    this.startLevel(this.save.level);
    if(new URLSearchParams(location.search).get('test')!=='1')this.showTitle();

    if (new URLSearchParams(location.search).get('test') === '1') {
      const timings:number[]=[];let frameStart=0;
      const begin=()=>{frameStart=performance.now();},end=()=>{timings.push(performance.now()-frameStart);if(timings.length>600)timings.shift();};
      this.game.events.on(Phaser.Core.Events.PRE_STEP,begin);this.game.events.on(Phaser.Core.Events.POST_RENDER,end);
      this.events.once('shutdown',()=>{this.game.events.off(Phaser.Core.Events.PRE_STEP,begin);this.game.events.off(Phaser.Core.Events.POST_RENDER,end);});
      (window as unknown as Record<string, unknown>).__densha = {
        perf:()=>{const a=timings.splice(0).sort((a,b)=>a-b);return {cpuP50:a[Math.floor(a.length*.5)],cpuP95:a[Math.floor(a.length*.95)],gameFps:this.game.loop.actualFps};},
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
        art:()=>hasArt(this,'dd_family'),
        renderInfo:()=>({pixelRatio:PIXEL_RATIO,eyeFrames:this.textures.get('dd_eyes').getFrameNames().length,signalFrames:hasArt(this,'dd_signals')?this.textures.get('dd_signals').getFrameNames().length:0}),
        trains:()=>[...this.views.values()].map(v=>({id:v.def.id,...v.inspect()})),
        definitions:()=>this.level.trains,
        state:()=>this.state.slice(),
        carriages:(id:number)=>this.views.get(id)?.geometry()??null,
        setTrainVisible:(id:number,visible:boolean)=>this.views.get(id)?.container.setVisible(visible),
        exitAudit:(enable?:boolean)=>{if(enable!==undefined)this.exitAudit=enable?[]:null;return this.exitAudit;},
        board:()=>({x:this.ox,y:this.oy,cs:this.cs,cols:this.level.cols,rows:this.level.rows}),
        effects:()=>({confetti:this.children.list.filter(o=>o.name==='three-star-confetti').map(o=>(o as Phaser.GameObjects.Particles.ParticleEmitter).getAliveParticleCount()),fps:this.game.loop.actualFps,travelSpeed:tune.feel.travelSpeed}),
      };
    }
  }

  // ------------------------------------------------------------- save / load

  private showTitle():void {
    this.titleOpen=true;
    const background=this.add.rectangle(WIDTH/2,HEIGHT/2,WIDTH,HEIGHT,0xffefdb).setInteractive();
    const title = createTitleArt(this, WIDTH / 2, 335, WIDTH - 32)
      ?? this.hudText(WIDTH / 2, 335, 40, '#74374a').setText('Kaiten Express');
    const start=new Button(this,WIDTH/2,525,210,58,this.save.level?'Continue':'Play',null,{fill:0x387d68,edge:0x92dac3},()=>{
      this.titleOpen=false;cover.destroy();
    },23);
    const cover=this.add.container(0,0,[background,title,start.container]).setDepth(450);
  }

  private loadSave(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Save;
        if (s.v === 2) {
          if (s.tutorialEdition !== 2) {
            if (s.stars.length > 2) s.stars.splice(2, 0, 0);
            if (s.level >= 2) s.level++;
            s.tutorialEdition = 2;
          }
          this.save = s;
          this.persist();
        }
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
      .text(x, y, '', { fontFamily: GAME_FONT, fontStyle: 'bold', fontSize: `${size}px`, color:color==='#ffffff'?'#74435c':color, strokeThickness:0, align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(240);
  }

  private startLevel(index: number): void {
    const previousLevel=this.level;
    this.levelIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    // Drop anything still scheduled from the previous round so it cannot move the new trains.
    this.playToken++;
    this.goalBalls.killAll();
    this.comboArt?.destroy();this.comboArt=undefined;
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    const reuseYard=previousLevel===this.level && this.trainLayer!==null;
    if(!reuseYard){
    this.trainLayer?.destroy();this.trainLayer=null;
    this.frontRowLayer?.destroy();this.frontRowLayer=null;
    this.yardArt.forEach(o=>o.destroy());this.yardArt=[];
    this.trainMasks.forEach(m=>m.destroy());this.trainMasks=[];
    } else {
      for(const obj of this.yardArt)if(obj.name?.startsWith('goal-')){this.tweens.killTweensOf(obj);(obj as Phaser.GameObjects.Graphics).setAlpha(0);}
    }
    this.clearOverlay();
    this.closeMenu();
    this.pending = null;
    this.arrows.clear();
    this.state = initialState(this.level);
    this.visualState=this.state.slice();
    this.readyStateKey='';
    this.taps = 0;
    this.longestChain=0;
    this.phase = 'play';
    // Rules come from tune.json; par is solved under the same rules so stars stay honest.
    this.rules = { followAfterSide: !!tune.rules.followAfterSide };
    const proven=this.rules.followAfterSide?PUZZLE_CONTRACTS.find(c=>c.name===this.level.name)?.par:undefined;
    this.par=proven??this.alternatePars.get(this.level)??solve(this.level,this.state,400000,this.rules).par;
    if(!this.rules.followAfterSide)this.alternatePars.set(this.level,this.par);
    this.limit = this.par + tune.rules.limitSlack;
    this.save.level = this.levelIndex;
    this.persist();

    this.cs = Math.floor(Math.min(BOARD_W / this.level.cols, (BOARD_BOTTOM - BOARD_TOP) / this.level.rows));
    this.ox = Math.round((WIDTH - this.cs * this.level.cols) / 2);
    this.oy = Math.round(BOARD_TOP + (BOARD_BOTTOM - BOARD_TOP - this.cs * this.level.rows) / 2);
    if(!reuseYard){
    this.yard.clear();
    this.yardArt=drawYard(this.yard, this.level, { cs: this.cs, ox: this.ox, oy: this.oy });
    this.trainLayer=this.add.container(0,0).setDepth(10);
    const mask=this.make.graphics({x:0,y:0},false);mask.fillStyle(0xffffff).fillRect(this.ox-this.cs*.12,this.oy-this.cs*.12,this.cs*(this.level.cols+.24),this.cs*(this.level.rows+.24));
    const geometry=mask.createGeometryMask();this.trainLayer.setMask(geometry);this.trainMasks.push(geometry);this.yardArt.push(mask);
    this.frontRowLayer=this.add.container(0,0).setDepth(12);
    const frontMask=this.make.graphics({x:0,y:0},false);
    frontMask.fillStyle(0xffffff).fillRect(this.ox-this.cs*.12,0,this.cs*(this.level.cols+.24),this.oy+this.cs*(this.level.rows+.12));
    const frontGeometry=frontMask.createGeometryMask();
    this.frontRowLayer.setMask(frontGeometry);this.trainMasks.push(frontGeometry);this.yardArt.push(frontMask);
    }
    for (const t of this.level.trains) {
      const v = new TrainView(this, t, this.cs);
      const c = v.centre(t.start, this.ox, this.oy);
      v.container.setPosition(c.x, c.y).setDepth(10 + t.id);
      const layer=t.axis==='h'&&t.line===0?this.frontRowLayer:this.trainLayer;
      layer!.add(v.container);
      this.views.set(t.id, v);
    }
    this.cursor = { c: 0, r: 0 };
    this.refreshHud();
    this.updateCoach();
  }

  private refreshHud(): void {
    this.hudLevel.setText(`LEVEL ${this.levelIndex + 1}   ·   Trains left ${trainsLeft(this.state)}`);
    this.hudTaps.setText(`${this.level.name}   |   Moves ${this.taps}   ·   Target ${this.par}`);
    if(this.limit-this.taps<=2)this.hudTaps.setText('Moves '+this.taps+'   ·   Target '+this.par+'   ·   '+Math.max(0,this.limit-this.taps)+' left');
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
    g.fillStyle(0xad7851, 1);
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

  private restarting=false;
  private restartWithFade():void {
    if(this.restarting)return;
    this.restarting=true;
    this.game.renderer.snapshot(frame=>{
      this.startLevel(this.levelIndex);
      if(!(frame instanceof HTMLImageElement)){this.restarting=false;return;}
      const key='dd_restart_frame';
      this.textures.addImage(key,frame);
      const old=this.add.image(0,0,key).setOrigin(0).setDisplaySize(WIDTH,HEIGHT).setDepth(500);
      this.tweens.add({targets:old,alpha:0,duration:150,ease:'Sine.InOut',onComplete:()=>{
        old.destroy();this.textures.remove(key);this.restarting=false;
      }});
    });
  }

  private onIntent(intent: Intent): void {
    if(this.titleOpen)return;
    if(this.restarting)return;
    if (intent.type === 'restart') return this.restartWithFade();
    if (intent.type === 'next') return this.isUnlocked(this.levelIndex + 1) ? this.startLevel(this.levelIndex + 1) : this.startLevel(this.levelIndex);
    if (intent.type === 'levels') return this.phase === 'menu' ? (this.closeMenu(), this.updateCoach()) : this.phase === 'play' ? ((this.menuPage = -1), this.openMenu()) : undefined;
    if (intent.type === 'select') return this.selectLevel(intent.level);
    if (this.phase !== 'play') return;
    if (intent.type === 'tap') {
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
      const across=this.level.trains[t].axis==='h'?intent.dy:intent.dx;
      if(Math.abs(across)>Math.abs(along))return this.restartWithFade();
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
    this.clearHint();for(const view of this.views.values())view.setAwake(false);
    const dirs = ([-1, 1] as Dir[]).filter((d) => canRun(this.level, this.state, train, d));
    this.pending = null;
    this.arrows.clear();
    if (dirs.length === 0) return this.restartWithFade();
    if (dirs.length === 1) return this.runTrain(train, dirs[0]);
    this.sfx.uiTap();
    this.pending = { train, dirs };
    this.showArrows(train);
  }

  private showArrows(train:number):void {
    const t=this.level.trains[train],v=this.views.get(train)!;v.setAwake(true);
    this.arrows.clear();const x=v.container.x-(t.axis==='h'?t.len:1)*this.cs/2-3,y=v.container.y-(t.axis==='v'?t.len:1)*this.cs/2-3,w=(t.axis==='h'?t.len:1)*this.cs+6,h=(t.axis==='v'?t.len:1)*this.cs+6;
    this.arrows.lineStyle(5,0xfffcf3,1);this.arrows.strokeRoundedRect(x,y,w,h,11);this.arrows.lineStyle(2,0x853e68,1);this.arrows.strokeRoundedRect(x,y,w,h,11);
    this.coach.setText(t.axis==='h'?'Swipe left or right to serve.':'Swipe up or down to serve.');
  }

  // ------------------------------------------------------------------- run

  private runTrain(train: number, dir: Dir): void {
    if (!canRun(this.level, this.state, train, dir)) return this.tapTrain(train);
    this.pending = null;
    this.arrows.clear();
    this.clearHint();
    const before=this.state.slice();this.visualState=before.slice();
    const res = applyTap(this.level, this.state, { train, dir }, this.rules);
    this.taps++;
    this.state = res.state;
    this.phase = 'animating';
    this.refreshHud();
    this.longestChain=Math.max(this.longestChain,res.links);
    this.play(res.events, res.links,before);
  }

  // ------------------------------------------------------------- animation

  /** Beat length for the k-th train in a chain: later links play faster, down to a floor. */
  private pace(link: number): number {
    return Math.max(tune.feel.chainFloor, Math.pow(tune.feel.chainCompress, link - 1));
  }

  private runDuration(distCells: number, link: number): number {
    return (tune.feel.runBaseMs + tune.feel.runPerCellMs * distCells) * this.pace(link)/tune.feel.travelSpeed;
  }

  /** Lays the events out on a timeline: runs, then horn and spook beats, overlapping so chains stay quick. */
  private play(events: TapEvent[], links: number,initial:State): void {
    const f = tune.feel;
    let cursor = 0;
    let lastRunStart = 0;
    let lastRunDur = 0;
    let exits = 0;
    let visualEnd=0;
    const token = this.playToken;
    const at = (ms: number, fn: () => void) => {
      this.timers.push(this.time.delayedCall(Math.max(1, ms), () => token === this.playToken && fn()));
    };
    // Pixel position of each train as of the end of its last scheduled run.
    const pos = new Map<number, number>();
    for (const [id] of this.views) pos.set(id, initial[id]);
    let combo = 0;
    const movingTrains=new Set<number>();

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
        const half=(t.len/2+1)*this.cs;
        const outside={x:t.axis==='h'?(e.dir>0?WIDTH+half:-half):to.x,y:t.axis==='v'?(e.dir>0?HEIGHT+half:-half):to.y};
        const tailMs=e.exited?this.runDuration((Math.abs(outside.x-to.x)+Math.abs(outside.y-to.y))/this.cs,e.link):0;
        // A resumed run starts while the train ahead is still moving off.
        const start = e.resume && lastRunDur ? lastRunStart + lastRunDur * f.resumeOverlap : cursor;
        at(start, () => {
          if(!movingTrains.has(e.train)){
            movingTrains.add(e.train);
            if(movingTrains.size>=2)this.showCombo(movingTrains.size);
          }
          v.setTravel(e.dir);
          let scored=false;
          const horizontal=t.axis==='h';
          const mouth=(horizontal?this.ox:this.oy)+(e.dir>0?(horizontal?this.level.cols:this.level.rows)*this.cs:0);
          const side=horizontal?(e.dir>0?'right':'left'):(e.dir>0?'down':'up');
          this.sfx.noise(0.1, 0.18, 1800);
          this.tweens.add({
            targets: v.container,
            x: to.x,
            y: to.y,
            duration: dur,
            ease: e.exited ? 'Sine.In' : 'Cubic.Out',
            onUpdate: e.exited?()=>{
              const nose=(horizontal?v.container.x:v.container.y)+e.dir*t.len*this.cs/2;
              if(scored||(nose-mouth)*e.dir<0)return;
              scored=true;
              const glow=this.children.getByName('goal-'+side+'-'+t.line) as Phaser.GameObjects.Graphics|null;
              if(glow){
                this.tweens.killTweensOf(glow);glow.setAlpha(1).setScale(.77);
                const inward=glow.rotation+Math.PI;
                for(let ray=0;ray<9;ray++){
                  const angle=inward+(ray-4)*.32;
                  const speed=this.cs*(2.3+Math.random()*1.5);
                  const ball=this.goalBalls.emitParticleAt(glow.x+Math.cos(angle)*this.cs*.17,glow.y+Math.sin(angle)*this.cs*.17,1);
                  if(ball){ball.velocityX=Math.cos(angle)*speed;ball.velocityY=Math.sin(angle)*speed;}
                }
                this.tweens.add({targets:glow,scaleX:1.85,scaleY:1.45,alpha:0,duration:520,ease:'Quad.Out'});
              }
              this.sfx.tone(440,.09,'triangle',.17,690);
              this.sfx.tone(880,.16,'sine',.16,undefined,.065);
            }:undefined,
            onComplete: () => {
              if (e.exited) {
                this.visualState[e.train]=-1;

                // Continue at full size under the cover until every carriage is offscreen.
                this.tweens.add({targets:v.container,x:outside.x,y:outside.y,duration:tailMs,ease:'Linear',onComplete:()=>{if(this.exitAudit)this.exitAudit.push({train:e.train,dir:e.dir,geometry:v.geometry()});v.destroy();this.views.delete(e.train);}});
              } else {this.visualState[e.train]=e.to;v.setTravel(null);}
            },
          });
          void from;
          void v.container.setPosition(from.x, from.y);
        });
        if(!e.exited){const brakeMs=f.brakeMs*this.pace(e.link);at(start+Math.max(0,dur-brakeMs),()=>v.react('brake',e.dir,brakeMs));}
        pos.set(e.train, e.exited ? e.to : e.to);
        lastRunStart = start;
        lastRunDur = dur;
        cursor = start + dur;
        visualEnd=Math.max(visualEnd,cursor+tailMs,(!e.exited&&nextE?.type!=='hit')?cursor+f.brakeMs*2+(t.len-1)*f.carriageDelayMs:0);
        if (e.exited) exits++;
        void nextE;
      } else {
        const runner = this.views.get(e.runner);
        const target = this.views.get(e.target);
        if (!runner || !target) return;
        const rt = this.level.trains[e.runner];
        const link = e.link;
        const beat = (e.spooked ? f.spookMs : f.hornMs * 0.6) * this.pace(link);
        visualEnd=Math.max(visualEnd,cursor+f.hornMs*2+(Math.max(runner.def.len,target.def.len)-1)*f.carriageDelayMs);
        const step = combo++;
        at(cursor, () => {
          this.horn(runner, rt.axis, e.dir, step, e.sameLine);
          if (e.spooked) this.spook(target, beat,e.targetDir);
          else this.bonk(target);
        });
        cursor += beat;
        lastRunDur = 0;
      }
    });

    at(Math.max(cursor,visualEnd) + 60, () => this.afterPlay(links, exits));
  }

  private showCombo(count:number):void {
    const calls=['Double Roll!','Triple Stack!','Wasabi Rush!','Sushi Surge!','Maki Mayhem!','Tempura Tempest!','Salmon Stampede!','Tsunami Roll!','Omakase Overdrive!','Mega Maki Meteor!','Cosmic Sushi Storm!'];
    const title=calls[count-2]??('Galaxy Roll '+count+'!');
    const tier=Math.min(count-2,8);
    this.comboArt?.destroy();
    this.coach.setText('');
    const burst=this.add.graphics();
    const label=this.hudText(0,0,22+tier, '#fff7dc').setText(title).setStroke('#74374a',5);
    const badge=this.hudText(0,-23,14,'#fff7dc').setText('×'+count).setStroke('#74374a',4);
    const half=Math.min(146,label.width/2+12);
    for(let n=0;n<6+tier*2;n++){
      const angle=n*Math.PI*2/(6+tier*2),x=Math.cos(angle),y=Math.sin(angle);
      burst.lineStyle(2+n%3,n%2?0xf2884e:0xf6bd50,.95);
      burst.lineBetween(x*(half+3),y*23,x*(half+10+tier),y*(28+tier));
    }
    const card=this.add.container(WIDTH/2,this.oy-34,[burst,label,badge]).setDepth(242).setScale(.66).setAngle(count%2?3:-3);
    this.comboArt=card;
    this.tweens.add({targets:card,scale:1.08,angle:0,duration:105,ease:'Quad.Out',onComplete:()=>{
      this.tweens.add({targets:card,scale:1,duration:110,ease:'Quad.Out'});
    }});
    this.tweens.add({targets:card,alpha:0,delay:470,duration:150,onComplete:()=>card.destroy()});
    card.once('destroy',()=>{this.tweens.killTweensOf(card);if(this.comboArt===card)this.comboArt=undefined;});
  }

  private horn(runner:TrainView,axis:'h'|'v',dir:Dir,step:number,_sameLine:boolean):void {
    const f=tune.feel;runner.react('honk',dir,f.hornMs*2);
    const p=Math.pow(2,Math.min(step,f.pitchStepMax)*f.pitchStepPerLink);
    this.sfx.tone(392*p,.14,'square',.13);this.sfx.tone(494*p,.14,'square',.11,undefined,.01);
    const x=runner.container.x+(axis==='h'?dir*(runner.def.len/2-.2)*this.cs:0),y=runner.container.y+(axis==='v'?dir*(runner.def.len/2-.2)*this.cs:-SIDE_BODY_LIFT*this.cs/116*.94)-this.cs*.35;
    const g=this.add.graphics({x,y}).setDepth(200);
    g.setName('honk-burst');
    // Soft cream rims, coral/mango signal rays, and a little expanding sound arc.
    for(const [i,angle] of [-55,-28,0,28,55].entries()){
      const a=angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a),length=22-Math.abs(i-2)*3;
      const points=(pad:number)=>[[-1-pad,-5],[-2.4-pad,-length],[2.4+pad,-length],[1+pad,-5]].map(([px,py])=>({x:px*co-py*si,y:px*si+py*co}));
      g.fillStyle(0xfff9ea);g.fillPoints(points(1.5),true);g.fillStyle(i%2?0xf3b446:0xec7e83);g.fillPoints(points(0),true);
    }
    g.lineStyle(1.5,0xd696ab,.7);g.beginPath();g.arc(0,0,27,Phaser.Math.DegToRad(242),Phaser.Math.DegToRad(298));g.strokePath();
    g.setAlpha(0).setScale(.45);
    this.tweens.add({targets:g,scale:1.12,alpha:1,duration:f.hornMs*.65,ease:'Back.Out'});
    this.tweens.add({targets:g,y:y-7,scale:1.25,alpha:0,delay:f.hornMs,duration:f.hornMs,ease:'Sine.In',onComplete:()=>g.destroy()});
    g.once('destroy',()=>this.tweens.killTweensOf(g));
  }

  /** The hit train is startled: stretches, skews and shakes, then springs away. */
  private spook(v:TrainView,beatMs:number,dir:Dir):void {
    v.react('ack',dir,beatMs+tune.feel.spookReleaseMs);
  }

  /** A hit train that does not move (crossing track or boxed in) just takes the bump. */
  private bonk(v:TrainView):void {v.react('blocked',v.def.headDir,tune.feel.brakeMs*2);}

  private afterPlay(links: number, exits: number): void {
    this.visualState=this.state.slice();for(const v of this.views.values())v.rest();
    void exits;
    if (links >= tune.feel.bigChainTrains) {
      if (!isCleared(this.state)) this.sfx.cleared();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.celebrateChain();
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
   * Guided tutorial for levels 1 to 4: a caption plus a pulsing ring and arrow on the train
   * an optimal solution taps next. It is only a hint: it never blocks or swallows input.
   */
  private updateCoach():void {
    this.clearHint();const lines=COACH[this.levelIndex];
    if(!lines||this.phase!=='play'){this.coach.setText('');return;}
    this.coach.setFontSize(14).setLineSpacing(4).setText(lines[Math.min(this.taps,lines.length-1)]);
    const top=118,gap=this.oy-8-top;if(this.coach.height>gap)this.coach.setFontSize(12);this.coach.setY(top+gap/2);
    const m=solve(this.level,this.state,400000,this.rules).moves[0],v=m?this.views.get(m.train):undefined;if(!m||!v)return;
    v.setAwake(true,m.dir);
    const t=this.level.trains[m.train];
    if(this.levelIndex===3){
      const direction=t.axis==='h'?(m.dir<0?'left':'right'):(m.dir<0?'up':'down');
      this.coach.setText(this.taps===0?'Swipe '+direction+' to make room for the other trains.':'Swipe '+direction+' to start the next chain.');
    }
    const g=this.add.graphics(),x=v.container.x-(t.axis==='h'?t.len:1)*this.cs/2-4,y=v.container.y-(t.axis==='v'?t.len:1)*this.cs/2-4,w=(t.axis==='h'?t.len:1)*this.cs+8,h=(t.axis==='v'?t.len:1)*this.cs+8;
    const bx=this.ox,by=this.oy,bw=this.level.cols*this.cs,bh=this.level.rows*this.cs,l=Math.max(bx,x),focusTop=Math.max(by,y),r=Math.min(bx+bw,x+w),bottom=Math.min(by+bh,y+h);
    g.fillStyle(0x543044,.16);g.fillRect(bx,by,Math.max(0,l-bx),bh);g.fillRect(r,by,Math.max(0,bx+bw-r),bh);g.fillRect(l,by,Math.max(0,r-l),Math.max(0,focusTop-by));g.fillRect(l,bottom,Math.max(0,r-l),Math.max(0,by+bh-bottom));
    g.lineStyle(5,0xfffcf3,1);g.strokeRoundedRect(x,y,w,h,11);g.lineStyle(2,0x853e68,1);g.strokeRoundedRect(x,y,w,h,11);
    const ring=this.add.container(0,0,[g]).setDepth(220);this.tweens.add({targets:ring,alpha:.78,duration:450,yoyo:true,repeat:-1});this.hint=ring;
    ring.once('destroy',()=>this.tweens.killTweensOf(ring));
    if(hasArt(this,'dd_glove')){
      const startX=v.container.x,startY=v.container.y;
      const hand=this.add.image(startX,startY,'dd_glove').setOrigin(.5,.97);
      hand.setScale(this.cs*.59/hand.height);ring.add(hand);
      const distance=m.dir*this.cs*.94;
      this.tweens.add({targets:hand,x:startX+(t.axis==='h'?distance:0),y:startY+(t.axis==='v'?distance:0),alpha:{from:1,to:.75},duration:690,repeatDelay:350,repeat:-1,ease:'Quad.InOut'});
      hand.once('destroy',()=>this.tweens.killTweensOf(hand));
    }
  }

  // ---------------------------------------------------------------- results

  private win(): void {
    this.phase = 'won';
    const stars = this.starsFor(this.taps);
    this.save.stars[this.levelIndex] = Math.max(this.save.stars[this.levelIndex] ?? 0, stars);
    const records=this.save.records??={};
    const old=records[this.level.name];
    records[this.level.name]={moves:Math.min(old?.moves??Infinity,this.taps),chain:Math.max(old?.chain??0,this.longestChain)};
    const nextOpen = this.levelIndex < LEVELS.length - 1 && this.isUnlocked(this.levelIndex + 1);
    this.save.level = nextOpen ? this.levelIndex + 1 : this.levelIndex;
    this.persist();
    this.sfx.cleared();
    this.showOverlay(this.taps===this.par?'Perfect!':'Level clear!',stars,nextOpen?'Next':'Levels',()=>{
      if(nextOpen)this.bus.emit({type:'next'});
      else {this.clearOverlay();this.menuPage=-1;this.openMenu();}
    });
  }

  private fail(): void {
    this.phase = 'failed';
    this.sfx.miss();
    this.showOverlay('Out of moves', 0, 'Try again', () => this.bus.emit({ type: 'restart' }));
  }

  private clearOverlay(): void {
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
  }

  private showOverlay(title: string, stars: number, label: string, onTap: () => void): void {
    this.clearHint();
    this.coach.setText('');
    this.clearOverlay();
    const dim=this.add.graphics().setDepth(300);dim.fillStyle(0x61485e,.38);dim.fillRect(0,0,WIDTH,HEIGHT);
    const panel = this.add.graphics().setDepth(310);
    panel.fillStyle(0x000000, 0.25);
    panel.fillRoundedRect(46, 268, WIDTH - 92, 280, 26);
    panel.fillStyle(0xfff8e6, 1);
    panel.fillRoundedRect(46, 260, WIDTH - 92, 280, 26);
    const t = this.hudText(WIDTH / 2, 310, 28, '#74435c').setDepth(310);
    t.setText(title);
    const decorations:Phaser.GameObjects.GameObject[]=[];
    if (stars > 0) for (let i = 0; i < 3; i++){
      const x=WIDTH/2+(i-1)*62,star=this.add.graphics({x,y:390});this.drawStar(star,0,0,26,i<stars?0xffd04a:0xc9c2b0);decorations.push(star);
      if(i<stars){
        star.setScale(tune.feel.starStartScale).setY(378).setAlpha(0);
        this.tweens.add({targets:star,scale:tune.feel.starPeakScale,y:390,alpha:1,delay:i*tune.feel.starStaggerMs,duration:tune.feel.starArrivalMs,ease:tune.feel.uiEase,onComplete:()=>{
          this.sfx.tone([523,659,784][i],.13,'sine',i===2?.23:.16);
          this.tweens.add({targets:star,scale:1,duration:tune.feel.starSettleMs,ease:tune.feel.uiEase});
        }});
      }
      if(i<stars){const glint=this.add.graphics({x,y:390});glint.lineStyle(2,0xffdc80,.9);for(let n=0;n<8;n++){const a=n*Math.PI/4;glint.lineBetween(Math.cos(a)*30,Math.sin(a)*30,Math.cos(a)*37,Math.sin(a)*37);}glint.setScale(.6).setAlpha(0);decorations.push(glint);this.tweens.add({targets:glint,scale:1.45,alpha:{from:1,to:0},delay:i*tune.feel.starStaggerMs+tune.feel.starArrivalMs,duration:tune.feel.uiBounceMs,ease:'Sine.Out'});}
    }
    else decorations.push(this.hudText(WIDTH / 2, 390, 15, '#795a68').setText(`Moves ${this.taps}   ·   Target ${this.par}`));
    if(stars){
      const record=this.save.records![this.level.name];
      decorations.push(this.hudText(WIDTH/2,344,16,'#74435c').setText('Moves '+this.taps+'   ·   Target '+this.par));
      decorations.push(this.hudText(WIDTH/2,430,16,'#74435c').setText('Best moves '+record.moves+'   ·   Longest chain '+record.chain));
      if(label==='Levels'&&this.levelIndex<LEVELS.length-1)decorations.push(this.hudText(WIDTH/2,451,12,'#74435c').setText('Next opens at '+this.gateNeed(this.levelIndex+1)+' stars'));
      const replay=new Button(this,129,490,119,50,'Replay',null,{fill:0x8b416d,edge:0xba7b9f},()=>this.bus.emit({type:'restart'}),18);
      decorations.push(replay.container);
    }
    const b = new Button(this, stars?261:WIDTH/2, stars?490:480, stars?119:220, stars?50:60, label, null, { fill: 0x2f9e5b, edge: 0x6dffa8 }, onTap, 22);
    const body=this.add.container(0,0,[panel,t,...decorations,b.container]).setDepth(310).setY(22);
    this.tweens.add({targets:body,y:0,duration:tune.feel.uiBounceMs,ease:tune.feel.uiEase});
    this.overlay.push(dim,body);
    for(const o of [body,...decorations])o.once('destroy',()=>this.tweens.killTweensOf(o));
    if(stars===3){
      const confetti=this.add.particles(0,0,'px',{emitting:false,maxParticles:tune.feel.confettiCount,lifespan:tune.feel.confettiMs,speedX:{min:-150,max:150},speedY:{min:-260,max:-90},gravityY:230,scaleX:{start:1.7,end:.9},scaleY:{start:.65,end:.35},rotate:{start:0,end:540},alpha:{start:1,end:0},tint:[0xf18d9e,0xf5c854,0x78b9c3,0xb6a0d8,0xfff5dc]}).setDepth(330).setName('three-star-confetti');
      const timer=this.time.delayedCall(tune.feel.starStaggerMs*2+tune.feel.starArrivalMs+tune.feel.starSettleMs+tune.feel.starHoldMs,()=>{confetti.explode(tune.feel.confettiCount/2,65,420);confetti.explode(tune.feel.confettiCount/2,WIDTH-65,420);});
      confetti.once('destroy',()=>timer.remove(false));this.overlay.push(confetti);
    }
  }

  // ------------------------------------------------------------ level selector

  private isUnlocked(i: number): boolean {
    if (tune.rules.unlockAll || this.save.unlockAll) return true;
    const cleared = this.save.stars.reduce((best, st, idx) => (st > 0 ? Math.max(best, idx) : best), -1);
    return i <= cleared + 1 && this.totalStars() >= this.gateNeed(i);
  }

  /** Index of the first level that is not open yet (or the last level). */
  private firstLocked(): number {
    for (let i = 0; i < LEVELS.length; i++) if (!this.isUnlocked(i)) return i;
    return LEVELS.length - 1;
  }

  private totalStars(): number {
    return this.save.stars.reduce((sum, st) => sum + (st ?? 0), 0);
  }

  /** Stars needed in total before level `i` opens: every `gateEvery` levels adds `gateStars`. */
  private gateNeed(i: number): number {
    return Math.floor(i / tune.rules.gateEvery) * tune.rules.gateStars;
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
    dim.fillStyle(0x61485e, 0.38);
    dim.fillRect(0, 0, WIDTH, HEIGHT);
    const card=this.add.graphics().setDepth(310);card.fillStyle(0x74435c,.18);card.fillRoundedRect(px,py+8,panelW,panelH,26);card.fillStyle(0xfff8e6);card.fillRoundedRect(px,py,panelW,panelH,26);
    this.menu.push(card);
    // Tapping the dimmed area outside the panel closes the menu.
    const zone = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0).setDepth(299).setInteractive();
    zone.on('pointerdown', () => this.bus.emit({ type: 'levels' }));
    const title = this.hudText(WIDTH / 2, py + 40, 28, '#74435c').setDepth(310);
    const nextGate = this.gateNeed(Math.min(LEVELS.length - 1, this.firstLocked()));
    const gateText = tune.rules.unlockAll || nextGate <= this.totalStars() ? `Stars ${this.totalStars()}` : `Stars ${this.totalStars()} / ${nextGate} to open more`;
    this.menu.push(this.hudText(WIDTH / 2, py + 68, 13, '#6a5a3a').setDepth(310).setText(gateText));
    let taps=0,lastTap=0;
    title.setInteractive().on('pointerdown',()=>{
      const now=this.time.now;taps=now-lastTap<750?taps+1:1;lastTap=now;
      if(taps===5){this.save.unlockAll=true;this.persist();this.openMenu();this.sfx.treasure();}
    });
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
    const content=this.menu.filter(o=>o!==dim&&o!==zone),body=this.add.container(0,22,content).setDepth(310);
    this.tweens.add({targets:body,y:0,duration:tune.feel.uiBounceMs,ease:tune.feel.uiEase});body.once('destroy',()=>this.tweens.killTweensOf(body));this.menu.push(body);
  }

  // -------------------------------------------------------------------- fx

  private celebrateChain(): void {
    const camera = this.cameras.main;
    if (this.tweens.isTweening(camera)) return;
    this.tweens.add({
      targets: camera,
      zoom: PIXEL_RATIO * tune.feel.chainSwellZoom,
      duration: tune.feel.chainSwellMs,
      ease: 'Sine.InOut',
      yoyo: true
    });
  }

  private say(text: string): void {
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 700, duration: 300 });
  }

  update(_time:number,delta:number): void {
    runtime.fps=Math.round(this.game.loop.actualFps);
    const readyKey=this.visualState.join(',');
    if(readyKey!==this.readyStateKey){for(const [id,v]of this.views)v.setReady(canRun(this.level,this.visualState,id,v.def.headDir));this.readyStateKey=readyKey;}
    for(const v of this.views.values())v.update(delta*this.tweens.timeScale);
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




