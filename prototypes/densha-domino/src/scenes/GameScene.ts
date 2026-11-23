import { createTitleArt } from '../render/titleArt';
import { GAME_FONT } from '../gameFont';
import Phaser from 'phaser';
import { GameSfx as Sfx } from '../sfxSamples';
import {GameButton as Button} from '../uiButton';
import { PUZZLE_CONTRACTS } from '../game/puzzle-contracts';
import { LEVELS } from '../game/levels';
import { type RuleOptions, applyTap, canRun, initialState, isCleared, look, trainAt, trainsLeft } from '../game/rules';
import { solve } from '../game/solver';
import { type Dir, GONE, type Level, type State, type TapEvent } from '../game/types';
import { type Intent, IntentBus, bindKeyboard, bindPointer } from '../input/intents';
import { BASE_W, HEIGHT, WIDTH, PIXEL_RATIO, colX, colY, takeResume, type Resume } from '../pixelRatio';
import { TrainView,SIDE_BODY_LIFT } from '../render/train';
import { drawYard } from '../render/yard';
import {preloadArt,registerArt,hasArt} from '../render/art';
import {makeIcon} from '../render/icons';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

/** On phones and tablets, ask for real fullscreen when the player starts. Unsupported (iPhone Safari) or refused requests are ignored. */
function requestFullscreenOnTouch(): void {
  try {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen || !matchMedia('(pointer: coarse)').matches) return;
    void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  } catch {
    /* not available here: play on in the page */
  }
}

export const SAVE_KEY = 'densha-domino:save:v2';
export const runtime = { goto: 1, apply: false, fps:60 };

interface Save {
  v: 2;
  level: number;
  stars: number[];
  tutorialEdition?: number;
  unlockAll?: boolean;
  records?: Record<string,{moves:number;chain:number}>;
  /** Hearts (owner, 21 November 2026): count, and the time the next heart started refilling. */
  hearts?: number;
  heartsAt?: number;
  /** A non-tutorial attempt with moves made and not yet won; charged on reload so reloading is not a free retry. */
  attemptLevel?: number;
  /** Kaiten Express Pass: unlimited hearts. */
  pass?: boolean;
  /** Rewarded ads watched today, for the daily cap. */
  ads?: { day: string; count: number };
}

/** Tutorial captions by level (index 0 to 2), then by tap number. Later levels have none. */
// Owner, 21 November 2026: nobody reads sentences, so the tutorial uses two- or three-word labels and
// teaches with the glove, board cues and a guided wrong move (TRAPS) instead.
const COACH: Record<number, string[]> = {
  0: ['Swipe it out'],
  1: ['Bump to honk'],
  2: ['Follow the face'],
  3: ['Open a gap'],
  4: ['Other chain first'],
};

/** Guided wrong move: on these levels the glove first points at a move that fails; the board then rewinds for free. */
const TRAPS: Record<number, { letter: string; dir: Dir }> = {
  3: { letter: 'A', dir: -1 },
  4: { letter: 'D', dir: 1 },
};

/** HUD card height and the space kept for the Menu and Restart corner buttons. */
const CARD_H = 56;
const BUTTONS_H = 52;
const BAR_W = 118;

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
  /**
   * HUD in three groups (owner, 21 November 2026): level and name; moves, target and stars; trains left
   * with a cab icon. layoutBoard() puts them in a row above the board (portrait) or in side columns
   * (wide screens), whichever leaves the bigger board.
   */
  private cardLevel!: Phaser.GameObjects.Container;
  private cardScore!: Phaser.GameObjects.Container;
  private cardTrains!: Phaser.GameObjects.Container;
  private plateLevel!: Phaser.GameObjects.Graphics;
  private plateScore!: Phaser.GameObjects.Graphics;
  private plateTrains!: Phaser.GameObjects.Graphics;
  private hudName!: Phaser.GameObjects.Text;
  private trainsText!: Phaser.GameObjects.Text;
  private cabIcon!: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private hudSide = false;
  private hudRowY = 0;
  private coachAt = { x: 0, y: 0, w: 300, top: false };
  private lastTrainsLeft = -1;
  /** Hearts pill at the top centre. */
  private heartsPill!: Phaser.GameObjects.Container;
  private heartsText!: Phaser.GameObjects.Text;
  private heartsShown = '';
  /** True from the first move of a heart-costing attempt until it is won or charged. */
  private attemptLive = false;
  /** The next startLevel is a free rewind (tutorial guided wrong move). */
  private freeRestart = false;
  /** Board before each move this attempt, for the rewarded Undo (owner, 23 November 2026). */
  private history: { state: State; taps: number; longestChain: number }[] = [];
  private undoBtn!: Button;
  private hintBtn!: Button;
  /** Y of the HUD star row; the HUD sits just above the board. */
  private exitAudit:object[]|null=null;
  private alternatePars=new Map<Level,number>();
  private levelIndex = 0;
  private level!: Level;
  private state: State = [];
  private par = 0;
  private limit = 0;
  private titleOpen=false;
  private effectsOn = true;
  private dialogOpen = false;
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
    this.effectsOn = localStorage.getItem('kaiten-express:effects') !== 'off';
    this.sfx = new Sfx(this, {
      volume: () => this.effectsOn ? tune.feel.volume : 0,
      pitchStep: () => tune.feel.pitchStepPerLink,
      pitchStepMax: () => tune.feel.pitchStepMax,
    });

    this.gBackdrop = this.add.graphics().setDepth(-10);
    this.gBackdrop.fillGradientStyle(0xfff3e1, 0xfff3e1, 0xf6dfc5, 0xf6dfc5, 1);
    this.gBackdrop.fillRect(0, 0, WIDTH, HEIGHT);
    this.gBackdrop.fillStyle(0xffffff, 0.35);
    for (const [x, y, r] of [[70, 70, 30], [320, 50, 22], [330, 760, 36], [50, 780, 26]]) this.gBackdrop.fillCircle(x * WIDTH / BASE_W, y * HEIGHT / 844, r);
    // Pack backdrop art (loose/bg-pack-1.webp, portrait 1080x1920), scaled to cover. On wide screens only its
    // middle would show, cutting the frame, so wide layouts keep the drawn gradient.
    if (hasArt(this, 'bg_pack_1') && HEIGHT / WIDTH >= 1.3) {
      const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'bg_pack_1').setDepth(-9);
      // Fill the screen; stretch up to 25% between axes so the tiled frame stays on screen, else cover.
      const sx = WIDTH / bg.width, sy = HEIGHT / bg.height;
      if (Math.max(sx, sy) / Math.min(sx, sy) <= 1.25) bg.setScale(sx, sy); else bg.setScale(Math.max(sx, sy));
    }

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
    // Sparkle art (loose/fx-sparkle.webp, 128 px) when loaded, else the drawn golden orb.
    const sparkle=hasArt(this,'fx_sparkle');
    this.goalBalls=this.add.particles(0,0,sparkle?'fx_sparkle':orbKey,{emitting:false,maxParticles:72,lifespan:{min:390,max:550},
      scale:sparkle?{start:.2,end:.04}:{start:.43,end:.09},rotate:sparkle?{min:0,max:90}:0,alpha:{start:1,end:0},speed:0}).setDepth(4);
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
    this.hudLevel = this.hudText(0, -9, 18, '#74435c');
    this.hudName = this.hudText(0, 13, 12, '#795a68');
    this.hudTaps = this.hudText(0, -11, 15, '#74435c');
    this.starsG = this.add.graphics();
    this.trainsText = this.hudText(0, 1, 19, '#74435c');
    this.plateLevel = this.add.graphics();
    this.plateScore = this.add.graphics();
    this.plateTrains = this.add.graphics();
    if (hasArt(this, 'dd_liveries_0')) this.cabIcon = this.add.image(0, 2, 'dd_liveries_0', '0-7').setDisplaySize(42, 23);
    else if (hasArt(this, 'icon_cab')) this.cabIcon = makeIcon(this, 'cab', 34, 0x74435c) as Phaser.GameObjects.Image;
    else {
      const g = this.add.graphics();
      g.fillStyle(0x5b3e5e).fillRoundedRect(-20, -9, 40, 21, 8).fillStyle(0xff7a59).fillRoundedRect(-20, -11, 40, 19, 9).fillStyle(0x543451).fillRoundedRect(6, -7, 10, 10, 4);
      this.cabIcon = g;
    }
    this.cardLevel = this.add.container(0, 0, [this.plateLevel, this.hudLevel, this.hudName]).setDepth(236);
    this.cardScore = this.add.container(0, 0, [this.plateScore, this.hudTaps, this.starsG]).setDepth(236);
    this.cardTrains = this.add.container(0, 0, [this.plateTrains, this.cabIcon, this.trainsText]).setDepth(236);
    const heart = hasArt(this, 'icon_heart') ? makeIcon(this, 'heart', 24, 0xe8435f) : this.add.graphics().fillStyle(0xe8435f).fillCircle(-5, -3, 6).fillCircle(5, -3, 6).fillTriangle(-10.5, -0.5, 10.5, -0.5, 0, 11);
    heart.setX(-30);
    this.heartsText = this.hudText(-16, 0, 15, '#74435c').setOrigin(0, 0.5);
    const pillBg = this.add.graphics().fillStyle(0x74435c, 0.08).fillRoundedRect(-52, -14, 104, 32, 16).fillStyle(0xfff9ee, 0.96).fillRoundedRect(-52, -16, 104, 32, 16);
    this.heartsPill = this.add.container(WIDTH / 2, 30, [pillBg, heart, this.heartsText]).setDepth(240);
    // Rewarded helpers (opt-in): Undo takes back the last move including the move count, so stars stay possible;
    // Hint shows the next best move. Pass holders skip the ad.
    this.undoBtn = new Button(this, 0, 0, 120, 42, 'Undo', null, { fill: 0x508067, edge: 0x9fc49c }, () => this.requestUndo(), 15);
    this.hintBtn = new Button(this, 0, 0, 120, 42, 'Hint', null, { fill: 0x387d68, edge: 0x92dac3 }, () => this.requestHint(), 15);
    this.undoBtn.container.setDepth(238); this.hintBtn.container.setDepth(238);
    // Icon left of the label, and a small play badge on the corner while the helper costs an ad.
    for (const [b, kind] of [[this.undoBtn, 'undo'], [this.hintBtn, 'hint']] as const) {
      const text = b.container.list.find((c) => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
      text.setX(11);
      b.container.add(makeIcon(this, kind, 22).setPosition(-29, 0));
      const badge = makeIcon(this, 'ad', 20).setPosition(56, -18).setName('ad-badge');
      if (badge instanceof Phaser.GameObjects.Container) badge.setPosition(54, -16);
      b.container.add(badge);
    }
    this.heartsPill.setSize(104, 32).setInteractive().on('pointerdown', () => { if (!this.heartsFree() && this.heartsNow() < tune.rules.heartsMax) this.showOutOfHearts(false); });
    this.banner = this.hudText(WIDTH / 2, HEIGHT / 2 - 22, 34, '#ffe27a').setDepth(230).setAlpha(0);
    this.coach = this.hudText(WIDTH / 2, 172, 16, '#74435c').setDepth(230).setPadding(12, 5, 12, 5).setBackgroundColor('rgba(255,249,238,0.94)').setAlign('center').setWordWrapWidth(Math.min(WIDTH, 560) - 50);
    this.yard = this.add.graphics().setDepth(0);
    this.arrows = this.add.graphics().setDepth(60);
    this.cursorG = this.add.graphics().setDepth(70);

    this.restartBtn = new Button(this, WIDTH-38, 30, 52, 42, '', null, { fill: 0x8b416d, edge: 0xba7b9f }, () => this.confirmRestart(), 16);
    this.levelsBtn = new Button(this, 38, 30, 52, 42, '', null, { fill: 0x508067, edge: 0x9fc49c }, () => this.bus.emit({ type: 'levels' }), 16);
    this.restartBtn.container.add(makeIcon(this, 'restart', 24));
    this.levelsBtn.container.add(makeIcon(this, 'menu', 22));
    this.restartBtn.container.setDepth(240);this.levelsBtn.container.setDepth(240);

    this.bus.on((i) => this.onIntent(i));
    bindKeyboard(this, this.bus);
    bindPointer(this, this.bus, () => tune.feel.swipePx);
    this.input.on('pointerdown', () => (this.hold = true));
    this.input.on('pointerup', () => (this.hold = false));
    this.input.on('pointerupoutside', () => (this.hold = false));

    this.loadSave();
    const resume = takeResume();
    // A fold/rotate rebuild keeps the attempt going (restored below, after the level is rebuilt).
    const keepAttempt = !!resume && resume.taps > 0 && this.save.attemptLevel === resume.level;
    if (!resume && this.save.attemptLevel !== undefined) {
      // The page was reloaded or closed mid-attempt: that attempt counts as lost.
      if (!this.save.pass) this.takeHeart();
      delete this.save.attemptLevel;
      this.persist();
    }
    this.startLevel(resume ? resume.level : this.save.level);
    if (resume) this.applyResume(resume);
    if (keepAttempt) { this.attemptLive = true; this.save.attemptLevel = this.levelIndex; this.persist(); }
    const title = resume ? resume.title : new URLSearchParams(location.search).get('test') !== '1';
    if(title)this.showTitle();

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
        next: () => { this.save.unlockAll = true; this.bus.emit({ type: 'next' }); },
        setPass: (on: boolean) => { this.save.pass = on; this.refreshHud(); },
        showGoals: () => this.children.list.filter((o) => o.name.startsWith('goal-')).map((o) => { (o as Phaser.GameObjects.Container).setAlpha(1).setScale(1); return o.name + ':' + o.type; }),
        menuOpen: () => this.phase === 'menu',
        coach: () => this.coach.text,
        hintShown: () => !!this.hint,
        slow: (s: number) => (this.testSlow = s),
        levels: () => LEVELS.length,
        layout: () => ({ w: WIDTH, h: HEIGHT }),
        noRooms: () => this.noRoomCount,
        hearts: () => ({ hearts: this.save.pass ? Infinity : this.heartsNow(), free: this.heartsFree(), attempt: this.attemptLive, next: this.nextHeartIn() }),
        setHearts: (n: number) => { this.save.hearts = n; this.save.heartsAt = Date.now(); this.persist(); this.heartsShown = ''; },
        art:()=>hasArt(this,'dd_family'),
        renderInfo:()=>({pixelRatio:PIXEL_RATIO,eyeFrames:this.textures.get('dd_eyes').getFrameNames().length,signalFrames:hasArt(this,'dd_signals')?this.textures.get('dd_signals').getFrameNames().length:0}),
        trains:()=>[...this.views.values()].map(v=>({id:v.def.id,x:v.container.x,y:v.container.y,...v.inspect()})),
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
    const title = createTitleArt(this, WIDTH / 2, colY(335), BASE_W - 32)
      ?? this.hudText(WIDTH / 2, colY(335), 40, '#74374a').setText('Kaiten Express');
    const start=new Button(this,WIDTH/2,colY(525),210,58,this.save.level?'Continue':'Play',null,{fill:0x387d68,edge:0x92dac3},()=>{
      this.titleOpen=false;cover.destroy();requestFullscreenOnTouch();
    },23);
    const menu = new Button(this,56,30,94,38,'Menu',null,{fill:0x508067,edge:0x9fc49c},()=>this.openTitleMenu(),16);
    const cover=this.add.container(0,0,[background,title,start.container,menu.container]).setDepth(450);
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
    if (this.attemptLive && !this.freeRestart) this.endAttempt(true);
    else this.endAttempt(false);
    this.freeRestart = false;
    if (index !== this.levelIndex) this.trapLevel = -1;
    this.history = [];
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

    this.layoutBoard();
    if(!reuseYard){
    this.yard.clear();
    this.yardArt=drawYard(this.yard, this.level, { cs: this.cs, ox: this.ox, oy: this.oy });
    this.yardArt.push(this.drawVeil());
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
    if (!reuseYard && !this.titleOpen) this.introLevel();
  }

  private introTweens: Phaser.Tweens.Tween[] = [];
  /** New level: trains drop onto their tracks one after another and the HUD cards fade up (under a second). */
  private introLevel(): void {
    this.finishIntro();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const f = tune.feel;
    const order = [...this.views.values()].sort((a, b) => a.container.y - b.container.y || a.container.x - b.container.x);
    order.forEach((v, i) => {
      const y = v.container.y;
      v.container.setY(y - this.cs * 0.7).setAlpha(0);
      this.introTweens.push(this.tweens.add({ targets: v.container, y, alpha: 1, delay: i * f.introStaggerMs, duration: f.introMs * 0.6, ease: 'Back.Out' }));
    });
    [this.cardLevel, this.cardScore, this.cardTrains].forEach((card, i) => {
      card.setAlpha(0);
      this.introTweens.push(this.tweens.add({ targets: card, alpha: 1, delay: 60 + i * 70, duration: f.introMs * 0.5 }));
    });
  }

  /** Jumps any running intro to its end, so the first move never fights it. */
  private finishIntro(): void {
    if (!this.introTweens.length) return;
    for (const t of this.introTweens) t.stop();
    this.introTweens = [];
    for (const [id, v] of this.views) {
      if (this.state[id] < 0) continue;
      const c = v.centre(this.state[id], this.ox, this.oy);
      v.container.setPosition(c.x, c.y).setAlpha(1);
    }
    for (const card of [this.cardLevel, this.cardScore, this.cardTrains]) card.setAlpha(1);
  }

  /** Level end: a cream curtain with a cab on its edge sweeps across, the next level is built behind it. */
  private wipeTo(build: () => void): void {
    if (this.restarting) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return build();
    this.restarting = true;
    const f = tune.feel, w = WIDTH + 80;
    const curtain = this.add.graphics().fillStyle(0xfff3e1, 1).fillRect(-w, 0, w, HEIGHT).fillStyle(0xf2a3a8, 1).fillRect(-14, 0, 14, HEIGHT);
    const cab = hasArt(this, 'dd_liveries_0') ? this.add.image(-6, HEIGHT / 2, 'dd_liveries_0', '0-7').setDisplaySize(84, 46) : this.add.graphics().fillStyle(0xff7a59).fillRoundedRect(-46, HEIGHT / 2 - 20, 80, 40, 14);
    const layer = this.add.container(0, 0, [curtain, cab]).setDepth(700);
    this.sfx.sample('whoosh', 1, 0.6);
    this.tweens.add({ targets: layer, x: w, duration: f.wipeMs, ease: 'Cubic.In', onComplete: () => {
      build();
      this.introLevel();
      if (cab instanceof Phaser.GameObjects.Image) cab.setFlipX(true);
      curtain.setX(0);
      this.tweens.add({ targets: layer, x: 2 * w, duration: f.wipeMs, ease: 'Cubic.Out', onComplete: () => {
        layer.destroy(); this.restarting = false;
      } });
    } });
    layer.once('destroy', () => this.tweens.killTweensOf(layer));
  }

  /** Puts the board back where the player was before the screen changed shape (fold, unfold, rotate). */
  private applyResume(r: Resume): void {
    if (r.level !== this.levelIndex || r.state.length !== this.state.length || isCleared(r.state)) return;
    this.finishIntro();
    this.state = r.state.slice();
    this.visualState = this.state.slice();
    this.taps = r.taps;
    this.longestChain = r.longestChain;
    for (const [id, v] of [...this.views]) {
      if (this.state[id] === GONE) {
        v.destroy();
        this.views.delete(id);
      } else {
        const c = v.centre(this.state[id], this.ox, this.oy);
        v.container.setPosition(c.x, c.y);
      }
    }
    this.readyStateKey = '';
    this.refreshHud();
    this.updateCoach();
  }

  /** What to carry over when the game is rebuilt for a new screen shape. */
  snapshot(): Resume {
    return { level: this.levelIndex, state: this.state.slice(), taps: this.taps, longestChain: this.longestChain, title: this.titleOpen };
  }

  /**
   * Board size and position plus the HUD mode. Tries the cards in a row above the board and in columns
   * beside it, and keeps whichever gives the bigger board (portrait phones: row; wide screens: columns).
   */
  private layoutBoard(): void {
    const cols = this.level.cols, rows = this.level.rows, coachH = COACH[this.levelIndex] ? 40 : 0, rim = 23, gap = 10;
    const csTop = Math.floor(Math.min((WIDTH - 40) / cols, (HEIGHT - BUTTONS_H - CARD_H - gap - coachH - rim - 36) / rows));
    const sideW = 150;
    const csSide = WIDTH >= 2 * sideW + 300 ? Math.floor(Math.min((WIDTH - 2 * sideW - 40) / cols, (HEIGHT - BUTTONS_H - rim - 30) / rows)) : 0;
    this.hudSide = csSide > csTop * 1.05;
    this.cs = this.hudSide ? csSide : csTop;
    const w = this.cs * cols, h = this.cs * rows;
    this.ox = Math.round((WIDTH - w) / 2);
    if (this.hudSide) {
      this.oy = Math.round(BUTTONS_H + rim + (HEIGHT - BUTTONS_H - rim - 30 - h) / 2);
    } else {
      // Portrait (owner, 21 November 2026): the board is centred on the screen and the card row sits in the
      // middle of the empty space above it, not hugging the board. A tutorial label goes between the two.
      const need = BUTTONS_H + CARD_H + 2 * gap + coachH + rim;
      this.oy = Math.max(need, Math.min(Math.round((HEIGHT - h) / 2), HEIGHT - 30 - h));
      const spaceBottom = this.oy - rim - coachH;
      this.hudRowY = Math.round((BUTTONS_H + spaceBottom) / 2);
      this.coachAt = { x: WIDTH / 2, y: Math.round((this.hudRowY + CARD_H / 2 + this.oy - rim) / 2), w: WIDTH - 50, top: false };
    }
  }

  private refreshHud(): void {
    const left = trainsLeft(this.state);
    this.hudLevel.setText(`LEVEL ${this.levelIndex + 1}`);
    this.hudName.setText(this.level.name);
    const near = this.limit - this.taps <= 2;
    this.hudTaps.setText(`Moves ${this.taps} / ${this.par}` + (near ? `  ·  ${Math.max(0, this.limit - this.taps)} left` : '')).setColor(near ? '#c0405e' : '#74435c');
    this.trainsText.setText(`× ${left}`);
    // Moves bar: fills as moves are used; a star sits on each threshold (3 at par, 2 at par + starSlack,
    // 1 at the limit) and stays lit while the moves are within it.
    const g = this.starsG;
    g.clear();
    const barW = BAR_W, x0 = -barW / 2, y = 11, limit = Math.max(1, this.limit);
    // Piecewise scale so the three stars never bunch up: 0..par fills 62% of the bar, each extra move after it
    // an equal share of the rest.
    const extra = Math.max(1, limit - this.par);
    const at = (m: number) => m <= this.par ? 0.62 * m / Math.max(1, this.par) : Math.min(1, 0.62 + 0.38 * (m - this.par) / extra);
    const fill = at(this.taps), stars = this.starsFor(this.taps);
    const color = this.taps <= this.par ? 0x5fb08a : this.taps <= this.par + tune.rules.starSlack ? 0xf0a640 : 0xd9546e;
    g.fillStyle(0x74435c, 0.14).fillRoundedRect(x0, y - 4, barW, 8, 4);
    if (fill > 0) g.fillStyle(color, 1).fillRoundedRect(x0, y - 4, Math.max(8, barW * fill), 8, 4);
    const marks = [this.par, this.par + tune.rules.starSlack, limit];
    marks.forEach((m, i) => {
      const mx = x0 + barW * at(m) - (i === 2 ? 7 : 0);
      this.drawStar(g, mx, y, 8, 3 - i <= stars ? 0xffd04a : 0xb9b0bd);
    });
    if (this.lastTrainsLeft >= 0 && left < this.lastTrainsLeft) {
      for (const o of [this.cabIcon, this.trainsText]) { this.tweens.killTweensOf(o); this.tweens.add({ targets: o, y: o.y - 5, duration: 110, yoyo: true, ease: 'Quad.Out' }); }
    }
    this.lastTrainsLeft = left;
    this.placeCards();
    this.placeAssist();
  }

  /** Undo and Hint under the board (portrait) or at the bottom of the left column (wide). */
  private placeAssist(): void {
    for (const b of [this.undoBtn, this.hintBtn]) (b.container.getByName('ad-badge') as Phaser.GameObjects.Container | null)?.setVisible(!this.save.pass);
    const bottom = this.oy + this.cs * this.level.rows;
    if (!this.hudSide) {
      const y = Math.min(HEIGHT - 30, bottom + 23 + 46);
      this.undoBtn.container.setPosition(WIDTH / 2 - 72, y);
      this.hintBtn.container.setPosition(WIDTH / 2 + 72, y);
    } else {
      const x = this.cardLevel.x;
      this.undoBtn.container.setPosition(x, bottom - 76);
      this.hintBtn.container.setPosition(x, bottom - 26);
    }
  }

  /** Sizes the card plates to their text and places the cards for the current HUD mode. */
  private placeCards(): void {
    const plate = (g: Phaser.GameObjects.Graphics, w: number) => g.clear()
      .fillStyle(0x74435c, 0.08).fillRoundedRect(-w / 2, -CARD_H / 2 + 3, w, CARD_H, 16)
      .fillStyle(0xfff9ee, 0.96).fillRoundedRect(-w / 2, -CARD_H / 2, w, CARD_H, 16);
    const levelW = Math.max(this.hudLevel.width, this.hudName.width) + 28;
    const scoreW = Math.max(this.hudTaps.width, BAR_W) + 28;
    const trainsW = 42 + 10 + this.trainsText.width + 28;
    this.cabIcon.setX(-trainsW / 2 + 14 + 21);
    this.trainsText.setX(-trainsW / 2 + 14 + 42 + 10 + this.trainsText.width / 2);
    plate(this.plateLevel, levelW); plate(this.plateScore, scoreW); plate(this.plateTrains, trainsW);
    if (!this.hudSide) {
      const gap = 8, total = levelW + scoreW + trainsW + 2 * gap, scale = Math.min(1, (WIDTH - 24) / total);
      let x = WIDTH / 2 - (total * scale) / 2;
      for (const [card, w] of [[this.cardLevel, levelW], [this.cardScore, scoreW], [this.cardTrains, trainsW]] as const) {
        card.setScale(scale).setPosition(x + (w * scale) / 2, this.hudRowY);
        x += (w + gap) * scale;
      }
      return;
    }
    // Side columns, aligned with the top of the board and kept clear of the tunnel mouths.
    const colR = Math.max(scoreW, trainsW);
    // Beyond the faded tunnel stubs when there is room, else against the screen edge.
    const clear = this.cs * 1.75;
    const leftX = Math.max(levelW / 2 + 10, this.ox - clear - levelW / 2);
    const rightX = Math.min(WIDTH - colR / 2 - 10, this.ox + this.cs * this.level.cols + clear + colR / 2);
    const y0 = this.oy + CARD_H / 2;
    this.cardLevel.setScale(1).setPosition(leftX, y0);
    this.cardScore.setScale(1).setPosition(rightX, y0);
    this.cardTrains.setScale(1).setPosition(rightX, y0 + CARD_H + 12);
    this.coachAt = { x: leftX, y: y0 + CARD_H / 2 + 14, w: Math.max(150, levelW), top: true };
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
    if(this.titleOpen || this.dialogOpen)return;
    if(this.restarting)return;
    if (intent.type === 'restart') return this.restartWithFade();
    if (intent.type === 'next') { const to = this.isUnlocked(this.levelIndex + 1) ? this.levelIndex + 1 : this.levelIndex; return this.wipeTo(() => this.startLevel(to)); }
    if (intent.type === 'levels') return this.phase === 'menu' ? (this.closeMenu(), this.updateCoach()) : this.phase === 'play' ? ((this.menuPage = -1), this.openMenu()) : undefined;
    if (intent.type === 'select') return this.selectLevel(intent.level);
    if (this.phase !== 'play') return;
    this.finishIntro();
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
      if(Math.abs(across)>Math.abs(along))return this.stuckCue(t,'Along the track');
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
    if (dirs.length === 0) return this.stuckCue(train,'Stuck!');
    if (dirs.length === 1) return this.runTrain(train, dirs[0]);
    this.sfx.uiTap();
    this.pending = { train, dirs };
    this.showArrows(train);
  }

  private showArrows(train:number):void {
    const t=this.level.trains[train],v=this.views.get(train)!;v.setAwake(true);
    this.arrows.clear();const x=v.container.x-(t.axis==='h'?t.len:1)*this.cs/2-3,y=v.container.y-(t.axis==='v'?t.len:1)*this.cs/2-3,w=(t.axis==='h'?t.len:1)*this.cs+6,h=(t.axis==='v'?t.len:1)*this.cs+6;
    this.arrows.lineStyle(5,0xfffcf3,1);this.arrows.strokeRoundedRect(x,y,w,h,11);this.arrows.lineStyle(2,0x853e68,1);this.arrows.strokeRoundedRect(x,y,w,h,11);
    this.coach.setText('Pick a way');
  }

  // ------------------------------------------------------------------- run

  private runTrain(train: number, dir: Dir): void {
    if (!canRun(this.level, this.state, train, dir)) {
      // Swiped straight into a train with no gap: say so, shake, and do not count a move.
      if (look(this.level, this.state, train, dir).kind === 'train') return this.noRoom(train);
      return this.tapTrain(train);
    }
    this.pending = null;
    this.arrows.clear();
    this.clearHint();
    if (this.taps === 0 && !this.heartsFree() && this.heartsNow() <= 0) return this.showOutOfHearts(true);
    if (!this.heartsFree() && !this.attemptLive) { this.attemptLive = true; this.save.attemptLevel = this.levelIndex; this.persist(); }
    this.lastMove={train,dir};
    this.history.push({ state: this.state.slice(), taps: this.taps, longestChain: this.longestChain });
    const before=this.state.slice();this.visualState=before.slice();
    const res = applyTap(this.level, this.state, { train, dir }, this.rules);
    this.taps++;
    this.state = res.state;
    this.phase = 'animating';
    this.refreshHud();
    this.longestChain=Math.max(this.longestChain,res.links);
    this.play(res.events, res.links,before);
  }

  // ---------------------------------------------------------------- hearts
  // Owner, 21 November 2026: an attempt that does not end in a win costs one heart (fail, deliberate
  // restart, leaving mid-level, reloading mid-attempt). Winning costs nothing. The tutorial, its guided
  // rewind, fold/rotate rebuilds and Pass holders are free. Hearts refill one every heartRefillMinutes,
  // computed from saved timestamps so they also refill while the game is closed.

  private heartsFree(): boolean {
    return !!this.save.pass || this.levelIndex < tune.rules.heartFreeLevels;
  }

  /** Current hearts after refilling from the saved timestamp. A clock moved backwards grants nothing. */
  private heartsNow(): number {
    const max = tune.rules.heartsMax, step = tune.rules.heartRefillMinutes * 60000, now = Date.now();
    let h = this.save.hearts ?? max, at = this.save.heartsAt ?? now;
    if (now < at) at = now;
    if (h >= max) { h = max; at = now; }
    else {
      const gained = Math.floor((now - at) / step);
      if (gained > 0) { h = Math.min(max, h + gained); at = h >= max ? now : at + gained * step; }
    }
    if (h !== this.save.hearts || at !== this.save.heartsAt) { this.save.hearts = h; this.save.heartsAt = at; this.persist(); }
    return h;
  }

  private takeHeart(): void {
    const h = this.heartsNow();
    if (h >= tune.rules.heartsMax) this.save.heartsAt = Date.now();
    this.save.hearts = Math.max(0, h - 1);
    this.persist();
    this.heartsShown = '';
  }

  private addHeart(): void {
    this.save.hearts = Math.min(tune.rules.heartsMax, this.heartsNow() + 1);
    this.persist();
    this.heartsShown = '';
  }

  /** Ends the current attempt; `lost` charges a heart (unless free). */
  private endAttempt(lost: boolean): void {
    if (lost && this.attemptLive && !this.save.pass) this.takeHeart();
    this.attemptLive = false;
    if (this.save.attemptLevel !== undefined) { delete this.save.attemptLevel; this.persist(); }
  }

  private nextHeartIn(): number {
    const h = this.heartsNow();
    if (h >= tune.rules.heartsMax) return 0;
    return Math.max(0, (this.save.heartsAt ?? Date.now()) + tune.rules.heartRefillMinutes * 60000 - Date.now());
  }

  private static clock(ms: number): string {
    const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  /** Updates the hearts pill when its text changes (called every frame; cheap). */
  private refreshHearts(): void {
    let text: string;
    if (this.save.pass) text = '∞';
    else {
      const h = this.heartsNow(), wait = this.nextHeartIn();
      text = wait > 0 ? `${h}  ${GameScene.clock(wait)}` : `${h}`;
    }
    if (text === this.heartsShown) return;
    this.heartsShown = text;
    this.heartsText.setText(text);
  }

  private adsToday(): number {
    const day = new Date().toISOString().slice(0, 10);
    if (this.save.ads?.day !== day) this.save.ads = { day, count: 0 };
    return this.save.ads.count;
  }

  /** Out of hearts (or asked from the pill): wait, watch an ad for a heart, or get the Pass. */
  private showOutOfHearts(blocked: boolean): void {
    const layer = this.dialog(blocked ? 'Out of hearts' : 'Hearts');
    const info = this.hudText(WIDTH / 2, colY(392), 15, '#795a68');
    const tick = () => { const w = this.nextHeartIn(); info.setText(w > 0 ? 'Next heart in ' + GameScene.clock(w) : 'Hearts are full'); };
    tick();
    const timer = this.time.addEvent({ delay: 500, loop: true, callback: tick });
    layer.once('destroy', () => timer.remove(false));
    const canAd = this.adsToday() < tune.rules.heartAdsPerDay && this.heartsNow() < tune.rules.heartsMax;
    const ad = new Button(this, WIDTH / 2 - 76, colY(440), 138, 42, canAd ? 'Watch ad +1' : 'No more ads', null, { fill: 0x387d68, edge: 0x92dac3 }, () => {
      if (!canAd) return;
      this.closeMenu();
      this.mockRewardedAd(() => { this.save.ads!.count++; this.addHeart(); });
    }, 15);
    if (!canAd) ad.container.setAlpha(0.55);
    const test = new URLSearchParams(location.search);
    const purchasable = test.get('test') === '1' || test.get('debug') === '1';
    const pass = new Button(this, WIDTH / 2 + 76, colY(440), 138, 42, purchasable ? 'Pass (test)' : 'Pass soon', null, { fill: 0x8b416d, edge: 0xba7b9f }, () => {
      if (!purchasable) return;
      this.save.pass = true; this.persist(); this.heartsShown = ''; this.closeMenu();
    }, 15);
    if (!purchasable) pass.container.setAlpha(0.55);
    const close = new Button(this, WIDTH / 2, colY(490), 110, 34, 'Close', null, { fill: 0x508067, edge: 0x9fc49c }, () => this.closeMenu(), 14);
    layer.add([info, ad.container, pass.container, close.container]);
  }

  /**
   * Placeholder for a rewarded ad until the real ad SDKs (AdMob, Meta Audience Network) are wired in.
   * Shows a short labelled screen and calls `reward` when it completes. Never forced.
   */
  private mockRewardedAd(reward: () => void): void {
    this.dialogOpen = true;
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x2c2230, 0.92).setInteractive();
    const label = this.hudText(WIDTH / 2, HEIGHT / 2, 20, '#fff9ee').setText('Ad placeholder (3)');
    const layer = this.add.container(0, 0, [shade, label]).setDepth(600);
    // Counted with a tween: a clock event created inside this button callback never fired here.
    const count = this.tweens.addCounter({ from: 3, to: 0, duration: 3000, onUpdate: (tw) => {
      label.setText(`Ad placeholder (${Math.ceil(tw.getValue() ?? 0)})`);
    }, onComplete: () => { layer.destroy(); this.dialogOpen = false; this.sfx.treasure(); reward(); } });
    layer.once('destroy', () => count.stop());
  }

  private requestUndo(): void {
    if (this.phase !== 'play' || this.dialogOpen || !this.history.length) return;
    if (this.save.pass) this.undoMove(); else this.mockRewardedAd(() => this.undoMove());
  }

  /** Puts the board, move count and longest chain back to before the last move. No heart is used. */
  private undoMove(): void {
    const snap = this.history.pop();
    if (!snap) return;
    const keep = this.history.slice(), live = this.attemptLive;
    // Where each train is now, so the rewind can slide it back (gone trains come back in from their exit).
    const from = new Map<number, { x: number; y: number }>();
    for (const [id, v] of this.views) if (this.state[id] >= 0) from.set(id, { x: v.container.x, y: v.container.y });
    this.freeRestart = true;
    this.startLevel(this.levelIndex);
    this.history = keep;
    this.applyResume({ level: this.levelIndex, state: snap.state, taps: snap.taps, longestChain: snap.longestChain, title: false });
    this.attemptLive = live;
    if (live) { this.save.attemptLevel = this.levelIndex; this.persist(); }
    this.refreshHud();
    this.rewind(from);
  }

  private rewind(from: Map<number, { x: number; y: number }>): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const f = tune.feel;
    if (!this.sfx.sample('whoosh', 1.25, 0.45)) this.sfx.noise(0.18, 0.12, 1400);
    for (const [id, v] of this.views) {
      const to = { x: v.container.x, y: v.container.y };
      let start = from.get(id);
      if (!start) {
        // Exited: enter from the nearer end of its track.
        const t = this.level.trains[id], span = (t.len / 2 + 0.6) * this.cs;
        if (t.axis === 'h') { const left = to.x - this.ox < this.ox + this.level.cols * this.cs - to.x; start = { x: left ? this.ox - span : this.ox + this.level.cols * this.cs + span, y: to.y }; }
        else { const top = to.y - this.oy < this.oy + this.level.rows * this.cs - to.y; start = { x: to.x, y: top ? this.oy - span : this.oy + this.level.rows * this.cs + span }; }
      }
      if (Math.abs(start.x - to.x) + Math.abs(start.y - to.y) < 1) continue;
      v.container.setPosition(start.x, start.y);
      this.introTweens.push(this.tweens.add({ targets: v.container, x: to.x, y: to.y, duration: f.undoRewindMs, ease: 'Cubic.InOut' }));
    }
  }

  private requestHint(): void {
    if (this.phase !== 'play' || this.dialogOpen) return;
    const show = () => { const m = solve(this.level, this.state, 400000, this.rules).moves[0]; if (m) { this.clearHint(); this.drawHint(m); } };
    if (this.save.pass) show(); else this.mockRewardedAd(show);
  }

  /** A short cue instead of a restart, for a swipe across the track or a tap on a train that cannot move. */
  private stuckCue(train: number, text: string): void {
    const v = this.views.get(train);
    if (!v) return;
    this.bonk(v);
    const t = this.level.trains[train];
    this.popLabel(v.container.x, v.container.y - (t.axis === 'v' ? t.len : 1) * this.cs / 2 - 14, text);
  }

  /** "No room!" pop and shake over a train swiped toward a train right in its way. No move is used. */
  private noRoomCount = 0;

  private noRoom(train: number): void {
    this.noRoomCount++;
    this.pending = null;
    this.arrows.clear();
    const v = this.views.get(train);
    if (!v) return;
    this.bonk(v);
    this.sfx.miss();
    const t = this.level.trains[train];
    this.popLabel(v.container.x, v.container.y - (t.axis === 'v' ? t.len : 1) * this.cs / 2 - 14, 'No room!');
  }

  /** A short readable pop (light backing so it never sits directly on game art). */
  private popLabel(x: number, y: number, text: string, holdMs = 750): void {
    const pop = this.hudText(x, y, 18, '#74435c').setText(text).setDepth(246).setScale(0.6)
      .setPadding(9, 4, 9, 4).setBackgroundColor('rgba(255,249,238,0.94)');
    this.tweens.add({ targets: pop, scale: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: pop, y: y - 14, alpha: 0, delay: holdMs, duration: 260, onComplete: () => pop.destroy() });
  }

  /** "No gap!" on a honked train whose face is blocked: a cross on the cell in front of its face, and a pop. */
  private noGap(v: TrainView): void {
    const t = v.def, half = t.len * this.cs / 2;
    const fx = v.container.x + (t.axis === 'h' ? t.headDir * (half + this.cs / 2) : 0);
    const fy = v.container.y + (t.axis === 'v' ? t.headDir * (half + this.cs / 2) : 0);
    const cross = this.add.graphics({ x: fx, y: fy }).setDepth(245);
    const k = this.cs * 0.2;
    cross.lineStyle(7, 0xfff9ee, 1).lineBetween(-k, -k, k, k).lineBetween(-k, k, k, -k);
    cross.lineStyle(4, 0xc0405e, 1).lineBetween(-k, -k, k, k).lineBetween(-k, k, k, -k);
    cross.setScale(0.5);
    this.tweens.add({ targets: cross, scale: 1, duration: 150, ease: 'Back.Out' });
    this.tweens.add({ targets: cross, alpha: 0, delay: 1500, duration: 300, onComplete: () => cross.destroy() });
    this.popLabel(v.container.x, v.container.y - (t.axis === 'v' ? t.len : 1) * this.cs / 2 - 14, 'No gap!', 1400);
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
    // Exit counter: every train that leaves pops "×n" at its tunnel with a rising note; the last exit of a
    // big chain freezes for a beat (hit-stop) and shakes the screen in proportion to the chain.
    const totalExits=events.filter((e)=>e.type==='run'&&e.exited).length;
    let scoredN=0;

    const movedThisTap = new Set<number>();
    events.forEach((e, idx) => {
      const nextE = events[idx + 1];
      if (e.type === 'run') {
        movedThisTap.add(e.train);
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
          if(!this.sfx.sample(e.exited?'whoosh':'clack',0.9+Math.random()*0.2,0.55))this.sfx.noise(0.1, 0.18, 1800);
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
              const n=++scoredN;
              this.exitPop(n,n===totalExits,glow?.x??(v.container.x+(horizontal?e.dir*t.len*this.cs/2:0)),glow?.y??(v.container.y+(horizontal?0:e.dir*t.len*this.cs/2)));
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
        if(!e.exited){const brakeMs=f.brakeMs*this.pace(e.link);at(start+Math.max(0,dur-brakeMs),()=>{v.react('brake',e.dir,brakeMs);this.sfx.sample('stop',0.95+Math.random()*0.1,0.5);this.puff('fx_dust',to.x+(t.axis==='h'?e.dir*t.len*this.cs/2:0),to.y+(t.axis==='v'?e.dir*t.len*this.cs/2:0),.5,e.dir,t.axis);});}
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
        // A honk that could not move a train still on the board: its face had no gap.
        const refused = !e.spooked && !movedThisTap.has(e.target);
        at(cursor, () => {
          this.horn(runner, rt.axis, e.dir, step, e.sameLine);
          if (e.spooked) this.spook(target, beat,e.targetDir);
          else { this.bonk(target); if (refused) this.noGap(target); }
        });
        cursor += beat;
        lastRunDur = 0;
      }
    });

    at(Math.max(cursor,visualEnd) + 60, () => this.afterPlay(links, exits));
  }

  /** A small art puff (steam on a honk, dust on a stop) that drifts with the motion and fades. Skipped without the art. */
  private puff(key:string,x:number,y:number,size:number,dir:Dir,axis:'h'|'v'):void {
    if(!hasArt(this,key)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const d=this.cs*size,img=this.add.image(x,y,key).setDisplaySize(d,d).setDepth(199).setAlpha(.9);
    const sx=img.scaleX;
    this.tweens.add({targets:img,x:x+(axis==='h'?dir*d*.35:0),y:y+(axis==='v'?dir*d*.35:-d*.25),scale:sx*1.6,alpha:0,duration:420,ease:'Quad.Out',onComplete:()=>img.destroy()});
    img.once('destroy',()=>this.tweens.killTweensOf(img));
  }

  private hitStopUntil=0;
  /** One train out: "×n" at the tunnel and a note that climbs a pentatonic scale with n. */
  private exitPop(n:number,final:boolean,x:number,y:number):void {
    const f=tune.feel;
    const steps=[0,2,4,7,9],k=n-1,semi=Math.floor(k/5)*12+steps[k%5];
    const freq=440*Math.pow(2,Math.min(semi,24)/12);
    if(!this.sfx.sample('exit',1+Math.min(semi,24)/24))this.sfx.tone(freq,.09,'triangle',.17,freq*1.57);
    this.sfx.tone(freq*2,.16,'sine',.14,undefined,.065);
    const big=final&&n>=tune.feel.bigChainTrains;
    const cx=Phaser.Math.Clamp(x,40,WIDTH-40),cy=Phaser.Math.Clamp(y,40,HEIGHT-40);
    const label=this.hudText(cx,cy,big?30:20+Math.min(n,6),'#fff7dc').setText('×'+n).setStroke('#74374a',5).setDepth(243).setScale(.4);
    this.tweens.add({targets:label,scale:1,duration:110,ease:'Back.Out'});
    this.tweens.add({targets:label,y:cy-this.cs*.6,alpha:0,delay:big?f.exitPopMs:f.exitPopMs*.5,duration:220,ease:'Quad.In',onComplete:()=>label.destroy()});
    label.once('destroy',()=>this.tweens.killTweensOf(label));
    if(!big)return;
    this.hitStopUntil=performance.now()+f.hitStopMs;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)this.cameras.main.shake(f.shakeMs,Math.min(.012,f.shakeBase+f.shakePerExit*n));
    if(!this.sfx.sample('win',1))this.sfx.tone(freq*1.5,.22,'sine',.15,undefined,.03);
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
    this.puff('fx_steam',x,y,.55,dir,axis);
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
    // Guided wrong move: after the failing move, rewind for free and show the right one.
    const trap = TRAPS[this.levelIndex];
    if (trap && this.trapLevel !== this.levelIndex) {
      this.trapLevel = this.levelIndex;
      const tt = this.level.trains.find((x) => x.letter === trap.letter);
      if (tt && this.lastMove?.train === tt.id && this.lastMove.dir === trap.dir) {
        this.clearHint();
        this.coach.setFontSize(20).setText('No gap! Again');
        this.fitCoach();
        this.timers.push(this.time.delayedCall(1500, () => { this.freeRestart = true; this.restartWithFade(); }));
        return; // input stays paused until the rewind
      }
    }
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
  /**
   * Emphasis on the play area (owner, 21 November 2026): a layer matching the background gradient covers
   * everything outside the board, with a soft-edged hole. Tunnel mouths at the edge stay visible; tunnel
   * stubs and decor further out fade into the background. Sits under the HUD, labels and pops.
   */
  private drawVeil(): Phaser.GameObjects.Image {
    const key = 'dd_play_veil', k = PIXEL_RATIO;
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, Math.ceil(WIDTH * k), Math.ceil(HEIGHT * k))!;
    const ctx = tex.context;
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT * k);
    grad.addColorStop(0, '#fff3e1');
    grad.addColorStop(1, '#f6dfc5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH * k, HEIGHT * k);
    const w = this.cs * this.level.cols, h = this.cs * this.level.rows;
    const clear = this.cs * 0.42, fade = this.cs * 1.35, steps = 14;
    const hole = (grow: number, alpha: number) => {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.beginPath();
      ctx.roundRect((this.ox - grow) * k, (this.oy - grow - this.cs * 0.25) * k, (w + 2 * grow) * k, (h + 2 * grow + this.cs * 0.25) * k, (16 + grow * 0.6) * k);
      ctx.fill();
    };
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < steps; i++) hole(fade - (fade - clear) * (i / steps), 0.22);
    hole(clear, 1);
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
    return this.add.image(0, 0, key).setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setDepth(200);
  }

  /** Centre the label in the gap between the stars and the board, shrinking it if it does not fit. */
  private fitCoach():void {
    this.coach.setWordWrapWidth(this.coachAt.w);
    if(this.coach.width>this.coachAt.w+24)this.coach.setFontSize(15);
    this.coach.setPosition(this.coachAt.x,this.coachAt.top?this.coachAt.y+this.coach.height/2:this.coachAt.y);
  }

  /** Level index whose guided wrong move has been shown (or skipped) on this visit. */
  private trapLevel=-1;
  private lastMove:{train:number;dir:Dir}|null=null;

  private updateCoach():void {
    this.clearHint();const lines=COACH[this.levelIndex];
    if(!lines||this.phase!=='play'){this.coach.setText('');return;}
    this.coach.setFontSize(20).setLineSpacing(4).setText(lines[Math.min(this.taps,lines.length-1)]);
    const solved=solve(this.level,this.state,400000,this.rules).moves[0];
    const byLetter=(letter:string)=>this.level.trains.find(x=>x.letter===letter);
    const moved=(letter:string)=>{const t=byLetter(letter);return !!t&&this.state[t.id]!==t.start;};
    // Guided wrong move first (once per visit): the glove points at the move that fails.
    const trap=TRAPS[this.levelIndex],trapTrain=trap?byLetter(trap.letter):undefined;
    const trapActive=!!trap&&!!trapTrain&&this.trapLevel!==this.levelIndex&&this.taps===0;
    const m=trapActive?{train:trapTrain!.id,dir:trap!.dir}:solved,v=m?this.views.get(m.train):undefined;if(!m||!v)return this.fitCoach();
    v.setAwake(true,m.dir);
    const t=this.level.trains[m.train];
    let offPath=false;
    if(this.levelIndex===3){
      const b=byLetter('B');
      const gapOpen=!!b&&this.state[b.id]!==GONE&&canRun(this.level,this.state,b.id,b.headDir);
      offPath=!trapActive&&!gapOpen&&moved('A');
      this.coach.setText(trapActive?'Try this':offPath?'No gap! Restart':gapOpen?'Now honk!':'Open a gap');
    }
    if(this.levelIndex===4){
      const a=byLetter('A');
      const firstChainDone=!a||this.state[a.id]===GONE;
      offPath=!trapActive&&!firstChainDone&&moved('D');
      this.coach.setText(trapActive?'Try this':offPath?'No gap! Restart':firstChainDone?'Second chain!':'Other chain first');
    }
    this.fitCoach();
    if(offPath)return;
    this.drawHint(m);
  }

  /** Focus ring and swiping glove on the move `m` (tutorial and the rewarded hint). Cleared by the next move. */
  private drawHint(m:{train:number;dir:Dir}):void {
    const v=this.views.get(m.train);if(!v)return;
    const t=this.level.trains[m.train];
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
    this.endAttempt(false);
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
    this.endAttempt(true);
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
    panel.fillRoundedRect(colX(46), colY(268), BASE_W - 92, 280, 26);
    panel.fillStyle(0xfff8e6, 1);
    panel.fillRoundedRect(colX(46), colY(260), BASE_W - 92, 280, 26);
    const t = this.hudText(WIDTH / 2, colY(310), 28, '#74435c').setDepth(310);
    t.setText(title);
    const decorations:Phaser.GameObjects.GameObject[]=[];
    if (stars > 0) for (let i = 0; i < 3; i++){
      const x=WIDTH/2+(i-1)*62,star=this.add.graphics({x,y:colY(390)});this.drawStar(star,0,0,26,i<stars?0xffd04a:0xc9c2b0);decorations.push(star);
      if(i<stars){
        star.setScale(tune.feel.starStartScale).setY(colY(378)).setAlpha(0);
        this.tweens.add({targets:star,scale:tune.feel.starPeakScale,y:colY(390),alpha:1,delay:i*tune.feel.starStaggerMs,duration:tune.feel.starArrivalMs,ease:tune.feel.uiEase,onComplete:()=>{
          if(!this.sfx.sample('star',[1,1.122,1.26][i]))this.sfx.tone([523,659,784][i],.13,'sine',i===2?.23:.16);
          this.tweens.add({targets:star,scale:1,duration:tune.feel.starSettleMs,ease:tune.feel.uiEase});
        }});
      }
      if(i<stars){const glint=this.add.graphics({x,y:colY(390)});glint.lineStyle(2,0xffdc80,.9);for(let n=0;n<8;n++){const a=n*Math.PI/4;glint.lineBetween(Math.cos(a)*30,Math.sin(a)*30,Math.cos(a)*37,Math.sin(a)*37);}glint.setScale(.6).setAlpha(0);decorations.push(glint);this.tweens.add({targets:glint,scale:1.45,alpha:{from:1,to:0},delay:i*tune.feel.starStaggerMs+tune.feel.starArrivalMs,duration:tune.feel.uiBounceMs,ease:'Sine.Out'});}
    }
    else decorations.push(this.hudText(WIDTH / 2, colY(390), 15, '#795a68').setText(`Moves ${this.taps}   ·   Target ${this.par}`));
    if(stars){
      const record=this.save.records![this.level.name];
      decorations.push(this.hudText(WIDTH/2,colY(344),16,'#74435c').setText('Moves '+this.taps+'   ·   Target '+this.par));
      decorations.push(this.hudText(WIDTH/2,colY(430),16,'#74435c').setText('Best moves '+record.moves+'   ·   Longest chain '+record.chain));
      if(label==='Levels'&&this.levelIndex<LEVELS.length-1)decorations.push(this.hudText(WIDTH/2,colY(451),12,'#74435c').setText('Next opens at '+this.gateNeed(this.levelIndex+1)+' stars'));
      const replay=new Button(this,colX(129),colY(490),119,50,'Replay',null,{fill:0x8b416d,edge:0xba7b9f},()=>this.bus.emit({type:'restart'}),18);
      decorations.push(replay.container);
    }
    const b = new Button(this, stars?colX(261):WIDTH/2, colY(stars?490:480), stars?119:220, stars?50:60, label, null, { fill: 0x2f9e5b, edge: 0x6dffa8 }, onTap, 22);
    const body=this.add.container(0,0,[panel,t,...decorations,b.container]).setDepth(310).setY(64).setAlpha(0);
    dim.setAlpha(0);this.tweens.add({targets:dim,alpha:1,duration:tune.feel.menuSlideMs*.7});dim.once('destroy',()=>this.tweens.killTweensOf(dim));
    this.tweens.add({targets:body,y:0,alpha:1,duration:tune.feel.menuSlideMs,ease:'Back.Out'});
    this.overlay.push(dim,body);
    for(const o of [body,...decorations])o.once('destroy',()=>this.tweens.killTweensOf(o));
    if(stars===3){
      const confetti=this.add.particles(0,0,'px',{emitting:false,maxParticles:tune.feel.confettiCount,lifespan:tune.feel.confettiMs,speedX:{min:-150,max:150},speedY:{min:-260,max:-90},gravityY:230,scaleX:{start:1.7,end:.9},scaleY:{start:.65,end:.35},rotate:{start:0,end:540},alpha:{start:1,end:0},tint:[0xf18d9e,0xf5c854,0x78b9c3,0xb6a0d8,0xfff5dc]}).setDepth(330).setName('three-star-confetti');
      const timer=this.time.delayedCall(tune.feel.starStaggerMs*2+tune.feel.starArrivalMs+tune.feel.starSettleMs+tune.feel.starHoldMs,()=>{confetti.explode(tune.feel.confettiCount/2,colX(65),colY(420));confetti.explode(tune.feel.confettiCount/2,colX(BASE_W-65),colY(420));});
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
    this.dialogOpen = false;
    this.menu.forEach((o) => o.destroy());
    this.menu = [];
    if (this.phase === 'menu') this.phase = 'play';
  }

  private effectsButton(y: number): Phaser.GameObjects.Container {
    const label = () => this.effectsOn ? 'Effects on' : 'Effects off';
    const button = new Button(this,WIDTH/2,y,138,40,label(),null,{fill:0x508067,edge:0x9fc49c},()=>{
      this.effectsOn = !this.effectsOn;
      localStorage.setItem('kaiten-express:effects', this.effectsOn ? 'on' : 'off');
      const text = button.container.list.find(child=>child instanceof Phaser.GameObjects.Text);
      if (text instanceof Phaser.GameObjects.Text) text.setText(label());
    },16);
    return button.container;
  }

  private dialog(title: string): Phaser.GameObjects.Container {
    this.closeMenu();
    this.dialogOpen = true;
    const shade = this.add.rectangle(WIDTH/2,HEIGHT/2,WIDTH,HEIGHT,0x61485e,.46).setInteractive();
    const panel = this.add.graphics().fillStyle(0xfff8e6).fillRoundedRect(colX(29),colY(315),BASE_W-58,202,22);
    const heading = this.hudText(WIDTH/2,colY(352),24,'#74435c').setText(title);
    const layer = this.add.container(0,0,[shade,panel,heading]).setDepth(500);
    this.menu.push(layer);
    return layer;
  }

  private openTitleMenu(): void {
    const layer = this.dialog('Sound');
    const close = new Button(this,WIDTH/2,colY(479),138,42,'Close',null,{fill:0x508067,edge:0x9fc49c},()=>this.closeMenu(),16);
    layer.add([this.effectsButton(colY(408)),close.container]);
  }

  private confirmRestart(): void {
    if (this.phase !== 'play' || this.restarting || this.dialogOpen) return;
    const layer = this.dialog('Restart this level?');
    const cancel = new Button(this,WIDTH/2-76,colY(470),138,44,'Cancel',null,{fill:0x508067,edge:0x9fc49c},()=>this.closeMenu(),16);
    const restart = new Button(this,WIDTH/2+76,colY(470),138,44,'Restart',null,{fill:0x8b416d,edge:0xba7b9f},()=>{
      this.closeMenu();
      this.restartWithFade();
    },16);
    layer.add([this.hudText(WIDTH/2,colY(400),15,'#795a68').setText(this.attemptLive?'Your moves reset. Uses 1 heart.':'Your moves on this board will reset.'),cancel.container,restart.container]);
  }

  /** A grid of levels with the stars earned so far. */
  private menuPage = -1;

  private openMenu(): void {
    const paging = this.phase === 'menu';
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
    const panelW = BASE_W - 50;
    const panelH = 170 + rows * rowH + 70;
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
    this.menu.push(this.effectsButton(py + 107));
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
      const y = py + 150 + r * rowH + cell / 2;
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
    const content=this.menu.filter(o=>o!==dim&&o!==zone),body=this.add.container(0,paging?22:64,content).setDepth(310);
    if(!paging){body.setAlpha(0);dim.setAlpha(0);this.tweens.add({targets:dim,alpha:1,duration:tune.feel.menuSlideMs*.7});dim.once('destroy',()=>this.tweens.killTweensOf(dim));}
    this.tweens.add({targets:body,y:0,alpha:1,duration:paging?tune.feel.uiBounceMs:tune.feel.menuSlideMs,ease:paging?tune.feel.uiEase:'Back.Out'});body.once('destroy',()=>this.tweens.killTweensOf(body));this.menu.push(body);
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
    this.coach.setVisible(this.coach.text.length>0);
    this.refreshHearts();
    const assist = this.phase === 'play' && !this.titleOpen && !this.dialogOpen && !COACH[this.levelIndex];
    this.undoBtn.container.setVisible(assist).setAlpha(this.history.length ? 1 : 0.45);
    this.hintBtn.container.setVisible(assist);
    runtime.fps=Math.round(this.game.loop.actualFps);
    const readyKey=this.visualState.join(',');
    if(readyKey!==this.readyStateKey){for(const [id,v]of this.views)v.setReady(canRun(this.level,this.visualState,id,v.def.headDir));this.readyStateKey=readyKey;}
    for(const v of this.views.values())v.update(delta*this.tweens.timeScale);
    if (runtime.apply) {
      runtime.apply = false;
      this.startLevel(runtime.goto - 1);
    }
    // Holding a finger down during a chain speeds it up.
    const stopped = performance.now() < this.hitStopUntil;
    const speed = stopped ? 0.03 : (this.phase === 'animating' && this.hold ? tune.feel.holdSpeed : 1) * this.testSlow;
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
  }
}




