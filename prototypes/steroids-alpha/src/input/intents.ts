// The only place that reads keys, the pointer or touches. Scenes read intents.
//   move       steer and throttle, in one of two schemes (both always available):
//                craft-relative   left/right rotates, up/down accelerates/brakes
//                direction marker the ship steers toward a direction; pushing further
//                                 accelerates harder; letting go eases back to minimum speed
//   primary    fire (held), also taps on menu buttons
//   secondary  unbound (the dash was removed)
//   pause      back
// Devices: keyboard is craft-relative (A/D or left/right rotate, W/S or up/down throttle,
// Space or J fire). Touch: floating stick on the left half, in the scheme
// chosen with the on-screen STEER button (remembered per browser), plus a fire button.
import { clientTune } from '../clientTune';
import { TUNE } from '../../sim/tune';
import { loadSave, writeSave } from '../save';

export type SteerScheme = 'marker' | 'craft';

function loadScheme(): SteerScheme {
  return loadSave().steer === 'craft' ? 'craft' : 'marker';
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
  /**
   * A canvas-drawn text box and the hidden input that takes its typing. Focus must happen inside the
   * tap event itself, or phones do not open their keyboard.
   */
  textBox: { zone: Zone; field: HTMLInputElement } | null = null;
  fireButton: Zone | null = null;
  schemeButton: Zone | null = null;

  private presses = new Set<Press>();
  private held = new Set<string>();
  private stickPointer: number | null = null;
  private firePointer: number | null = null;

  /**
   * Phone play is landscape only (owner decision). On a touch device held upright the game shows a
   * rotate prompt and every intent reads as neutral until the phone is turned.
   */
  get portraitBlocked(): boolean {
    return this.touch && window.innerHeight > window.innerWidth;
  }

  /** Fire is held (keyboard Space or J, or a finger on the fire button). */
  get fire(): boolean {
    if (this.portraitBlocked) return false;
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
    if (this.portraitBlocked) {
      this.presses.clear();
      return false;
    }
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
    // Typing into the pilot-name field is text, not flying.
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (down && !this.held.has(k)) {
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
    writeSave({ steer: this.scheme });
  }

  /** The move intent for one step, from whichever device is active. speed is the ship's current speed. */
  flight(speed: number): { turn: number; aim: number; thrust: number } {
    if (this.portraitBlocked) return { turn: 0, aim: NaN, thrust: 0 };
    const st = this.stick;
    if (!st) {
      // No finger on the stick counts as the stick at rest: in marker mode the ship eases back to
      // minimum speed. Keyboard throttle, when pressed, still wins.
      const rest = this.touch && this.scheme === 'marker' && speed > TUNE.ship.minSpeed ? -1 : 0;
      return { turn: this.turn, aim: NaN, thrust: this.thrust !== 0 ? this.thrust : rest };
    }
    const r = clientTune.touch.joystickRadius;
    const dead = clientTune.touch.deadZone;
    const nx = st.dx / r;
    const ny = st.dy / r;
    if (this.scheme === 'craft') {
      const axis = (v: number): number => (Math.abs(v) < dead ? 0 : (Math.sign(v) * (Math.abs(v) - dead)) / (1 - dead));
      return { turn: axis(nx), aim: NaN, thrust: axis(-ny) };
    }
    // Direction marker (owner decision): with the stick at rest the ship eases back to minimum speed.
    // Pushing it accelerates, gently at first and at full strength only near the edge.
    const mag = Math.min(1, Math.hypot(nx, ny));
    if (mag < dead) return { turn: 0, aim: NaN, thrust: speed > TUNE.ship.minSpeed ? -1 : 0 };
    const push = (mag - dead) / (1 - dead);
    return { turn: 0, aim: Math.atan2(ny, nx), thrust: Math.pow(push, clientTune.touch.markerThrustCurve) };
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') this.touch = true;
    if (this.portraitBlocked) return;
    const x = e.clientX;
    const y = e.clientY;
    this.taps.push({ x, y });
    const hit = (z: Zone | null): boolean => !!z && Math.abs(x - z.x) <= z.hw && Math.abs(y - z.y) <= z.hh;
    // The text field sits over its box and takes its own taps; a tap anywhere else closes the keyboard.
    if (this.textBox && !hit(this.textBox.zone)) this.textBox.field.blur();
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
