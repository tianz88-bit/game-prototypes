// The only place that reads keys, the pointer or touches. Scenes read intents.
//   move       steer: keyboard turn axis, or a joystick target heading
//   primary    fire (not used yet), also taps on menu buttons
//   secondary  dash
//   pause      back
// Devices: keyboard (A/D or arrows, Shift or K to dash, Space or J to fire),
// and touch (left half: floating joystick, right side: dash button).
import { clientTune } from '../clientTune';

export interface Stick {
  /** Where the finger went down, logical pixels. */
  ox: number;
  oy: number;
  /** Knob offset from the origin, clamped to the joystick radius. */
  dx: number;
  dy: number;
}

type Press = 'primary' | 'secondary' | 'pause';

export class Intents {
  /** Keyboard steering, -1 .. 1. */
  turn = 0;
  /** Joystick target heading, or NaN. */
  aim = NaN;
  /** Active joystick, for drawing. */
  stick: Stick | null = null;
  /** True on a touch device, or after the first touch. */
  touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  /** Last tap or click, logical pixels (menu buttons read this). */
  taps: { x: number; y: number }[] = [];
  /** Hit test for the on-screen dash button, set by the flight scene. */
  dashButton: { x: number; y: number; r: number } | null = null;

  private presses = new Set<Press>();
  private held = new Set<string>();
  private stickPointer: number | null = null;

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
    if (['arrowleft', 'arrowright', 'a', 'd', ' '].includes(k)) e.preventDefault();
    this.refreshTurn();
  }

  private refreshTurn(): void {
    const left = this.held.has('arrowleft') || this.held.has('a');
    const right = this.held.has('arrowright') || this.held.has('d');
    this.turn = (right ? 1 : 0) - (left ? 1 : 0);
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') this.touch = true;
    const x = e.clientX;
    const y = e.clientY;
    this.taps.push({ x, y });
    const b = this.dashButton;
    if (b && (x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r * 1.3) ** 2) {
      this.presses.add('secondary');
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
    this.aim = len / r >= clientTune.touch.deadZone ? Math.atan2(dy, dx) : NaN;
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.stickPointer) this.endStick();
  }

  private endStick(): void {
    this.stickPointer = null;
    this.stick = null;
    this.aim = NaN;
  }
}

export const intents = new Intents();
