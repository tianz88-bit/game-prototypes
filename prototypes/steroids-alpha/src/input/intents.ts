// The only place that reads keys, the pointer or touches. Scenes read intents.
//   move       steer and throttle, in one of two schemes (both always available):
//                craft-relative   left/right rotates, up/down accelerates/brakes
//                direction marker the ship steers toward a direction; how far the
//                                 stick is pushed sets the target speed
//   primary    fire (held), also taps on menu buttons
//   secondary  dash
//   pause      back
// Devices: keyboard is craft-relative (A/D or left/right rotate, W/S or up/down throttle,
// Shift or K dash, Space or J fire). Touch: floating stick on the left half, in the scheme
// chosen with the on-screen STEER button (remembered per browser), plus fire and dash buttons.
import { clientTune } from '../clientTune';
import { TUNE } from '../../sim/tune';

export type SteerScheme = 'marker' | 'craft';
const SAVE_KEY = 'steroids-alpha:save:v1';

function loadScheme(): SteerScheme {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as { steer?: string };
    return v.steer === 'craft' ? 'craft' : 'marker';
  } catch {
    return 'marker';
  }
}

export interface Zone {
  x: number;
  y: number;
  /** Half extents for a box, or equal for a circle-ish hit area. */
  hw: number;
  hh: number;
}

export interface Stick {
  /** Where the finger went down, logical pixels. */
  ox: number;
  oy: number;
  /** Knob offset from the origin, clamped to the joystick radius. */
  dx: number;
  dy: number;
}

type Press = 'primary' | 'secondary' | 'pause' | 'scheme';

export class Intents {
  /** Keyboard steering, -1 .. 1. */
  turn = 0;
  /** Keyboard throttle, -1 .. 1. */
  thrust = 0;
  /** Touch stick scheme. */
  scheme: SteerScheme = loadScheme();
  /** Active joystick, for drawing. */
  stick: Stick | null = null;
  /** True on a touch device, or after the first touch. */
  touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  /** Last tap or click, logical pixels (menu buttons read this). */
  taps: { x: number; y: number }[] = [];
  /** Hit areas for on-screen buttons, set by the flight scene. */
  dashButton: Zone | null = null;
  fireButton: Zone | null = null;
  schemeButton: Zone | null = null;

  private presses = new Set<Press>();
  private held = new Set<string>();
  private stickPointer: number | null = null;
  private firePointer: number | null = null;

  /** Fire is held (keyboard Space or J, or a finger on the fire button). */
  get fire(): boolean {
    return this.firePointer !== null || this.held.has(' ') || this.held.has('j');
  }

  attach(canvas: HTMLElement): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.refreshTurn();
      this.endStick();
      this.firePointer = null;
    });
  }

  /** True once per press since the last call. */
  consume(p: Press): boolean {
    const had = this.presses.has(p);
    this.presses.delete(p);
    return had;
  }

  drainTaps(): { x: number; y: number }[] {
    const out = this.taps;
    this.taps = [];
    return out;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.toLowerCase();
    if (down && !this.held.has(k)) {
      if (k === 'shift' || k === 'k') this.presses.add('secondary');
      if (k === ' ' || k === 'j') this.presses.add('primary');
      if (k === 'escape') this.presses.add('pause');
    }
    if (down) this.held.add(k);
    else this.held.delete(k);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '].includes(k)) e.preventDefault();
    this.refreshTurn();
  }

  private refreshTurn(): void {
    const left = this.held.has('arrowleft') || this.held.has('a');
    const right = this.held.has('arrowright') || this.held.has('d');
    this.turn = (right ? 1 : 0) - (left ? 1 : 0);
    const up = this.held.has('arrowup') || this.held.has('w');
    const down = this.held.has('arrowdown') || this.held.has('s');
    this.thrust = (up ? 1 : 0) - (down ? 1 : 0);
  }

  toggleScheme(): void {
    this.scheme = this.scheme === 'marker' ? 'craft' : 'marker';
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ steer: this.scheme }));
    } catch {
      // Private mode or blocked storage: the choice just lasts for this visit.
    }
  }

  /**
   * The move intent for one step, from whichever device is active. speed is the ship's current
   * speed (the direction-marker scheme steers the throttle toward a target speed).
   */
  flight(speed: number): { turn: number; aim: number; thrust: number } {
    const st = this.stick;
    if (!st) return { turn: this.turn, aim: NaN, thrust: this.thrust };
    const r = clientTune.touch.joystickRadius;
    const dead = clientTune.touch.deadZone;
    const nx = st.dx / r;
    const ny = st.dy / r;
    if (this.scheme === 'craft') {
      const axis = (v: number): number => (Math.abs(v) < dead ? 0 : (Math.sign(v) * (Math.abs(v) - dead)) / (1 - dead));
      return { turn: axis(nx), aim: NaN, thrust: axis(-ny) };
    }
    const mag = Math.min(1, Math.hypot(nx, ny));
    if (mag < dead) return { turn: 0, aim: NaN, thrust: 0 };
    const target = TUNE.ship.minSpeed + ((mag - dead) / (1 - dead)) * (TUNE.ship.maxSpeed - TUNE.ship.minSpeed);
    const thrust = Math.max(-1, Math.min(1, (target - speed) / clientTune.touch.speedBand));
    return { turn: 0, aim: Math.atan2(ny, nx), thrust };
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') this.touch = true;
    const x = e.clientX;
    const y = e.clientY;
    this.taps.push({ x, y });
    const hit = (z: Zone | null): boolean => !!z && Math.abs(x - z.x) <= z.hw && Math.abs(y - z.y) <= z.hh;
    if (hit(this.dashButton)) {
      this.presses.add('secondary');
      return;
    }
    if (hit(this.fireButton)) {
      this.firePointer = e.pointerId;
      return;
    }
    if (hit(this.schemeButton)) {
      this.presses.add('scheme');
      return;
    }
    if (this.touch && x < window.innerWidth / 2 && this.stickPointer === null) {
      this.stickPointer = e.pointerId;
      this.stick = { ox: x, oy: y, dx: 0, dy: 0 };
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickPointer || !this.stick) return;
    const r = clientTune.touch.joystickRadius;
    let dx = e.clientX - this.stick.ox;
    let dy = e.clientY - this.stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > r) {
      dx = (dx / len) * r;
      dy = (dy / len) * r;
    }
    this.stick.dx = dx;
    this.stick.dy = dy;
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.stickPointer) this.endStick();
    if (e.pointerId === this.firePointer) this.firePointer = null;
  }

  private endStick(): void {
    this.stickPointer = null;
    this.stick = null;
  }
}

export const intents = new Intents();
