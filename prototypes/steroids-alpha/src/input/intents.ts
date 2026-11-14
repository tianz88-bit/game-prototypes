// The only place that reads keys, the pointer or touches. Scenes read intents.
//   move       steer and throttle, in one of two schemes (both always available):
//                craft-relative   left/right rotates, up/down accelerates/brakes
//                direction marker the ship steers toward a direction; pushing further
//                                 accelerates harder; letting go eases back to minimum speed
//   primary    fire (held), also taps on menu buttons
//   secondary  dash, aimed (see dashAim)
//   buy        shop purchases (one-tap buttons top left, or number keys)
//   pause      back
// Devices: keyboard is craft-relative (A/D or left/right rotate, W/S or up/down throttle,
// Shift or K dash (with S for a 180, A or D for 90 degrees), Space or J fire, Q missile, E mine, 1-5 buy turret/shield/guns/missile/mine). Touch: floating stick on the left half, in the scheme
// chosen with the on-screen STEER button (remembered per browser), plus fire and dash buttons.
import { clientTune } from '../clientTune';
import { TUNE } from '../../sim/tune';
import { loadSave, writeSave } from '../save';

export type SteerScheme = 'marker' | 'craft';

function loadScheme(): SteerScheme {
  const saved = loadSave();
  const mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  // Phones always steer with the direction marker (owner, 14 November 2026: the toggle is gone).
  if (mobile) return 'marker';
  return saved.steer === 'craft' ? 'craft' : 'marker';
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

type Press = 'primary' | 'secondary' | 'pause' | 'scheme' | 'copied' | 'copyFailed' | 'missile' | 'mine' | 'warp';

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
  /**
   * A tap here copies text to the clipboard. Phones only allow the clipboard during a finger lift,
   * so the copy happens on pointerup (pressed and released inside the zone); the scene reads the
   * outcome as the 'copied' or 'copyFailed' press.
   */
  copyZone: { zone: Zone; text: string } | null = null;
  private copyPointer: number | null = null;
  dashButton: Zone | null = null;
  /** Missile and mine buttons (touch), shown once owned. */
  missileButton: Zone | null = null;
  /** Warp button (touch and mouse): starts warp mode after lockdown, or cancels it. */
  warpButton: Zone | null = null;
  mineButton: Zone | null = null;
  /** One-tap shop buttons (top left in flight); a tap queues that item. */
  shopZones: { item: number; zone: Zone }[] = [];
  private buys: number[] = [];

  /** Shop items asked for since the last call (item numbers, see SHOP_ITEMS). */
  consumeBuys(): number[] {
    return this.buys.splice(0);
  }

  /**
   * Where an aimed dash should point (radians, world), or NaN for straight ahead. heading is the
   * ship's current heading. Touch: the stick's direction, absolute in marker mode and relative to
   * the nose in craft mode (pull back = 180). Keyboard: hold S for a 180, A or D for 90 left or right.
   */
  dashAim(heading: number): number {
    if (this.portraitBlocked) return NaN;
    const st = this.stick;
    if (st) {
      const r = clientTune.touch.joystickRadius;
      const nx = st.dx / r;
      const ny = st.dy / r;
      if (Math.hypot(nx, ny) < clientTune.touch.deadZone) return NaN;
      return this.scheme === 'marker' ? Math.atan2(ny, nx) : heading + Math.atan2(nx, -ny);
    }
    const h = (k: string): boolean => this.held.has(k);
    if (h('s') || h('arrowdown')) return heading + Math.PI;
    if (h('a') || h('arrowleft')) return heading - Math.PI / 2;
    if (h('d') || h('arrowright')) return heading + Math.PI / 2;
    return NaN;
  }
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
      if (k === 'shift' || k === 'k') this.presses.add('secondary');
      if (k >= '1' && k <= '6' && k.length === 1) this.buys.push(Number(k) - 1); // 6: evolve
      if (k === 'q') this.presses.add('missile');
      if (k === 'e') this.presses.add('mine');
      if (k === 'r') this.presses.add('warp');
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
    if (this.touch) return; // phones are marker only
    this.scheme = this.scheme === 'marker' ? 'craft' : 'marker';
    writeSave(this.touch ? { mobileSteer: this.scheme } : { steer: this.scheme });
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
    if (e.pointerType === 'touch') {
      this.touch = true;
      this.scheme = 'marker';
    }
    if (this.portraitBlocked) return;
    const x = e.clientX;
    const y = e.clientY;
    this.taps.push({ x, y });
    const hit = (z: Zone | null): boolean => !!z && Math.abs(x - z.x) <= z.hw && Math.abs(y - z.y) <= z.hh;
    if (hit(this.copyZone?.zone ?? null)) this.copyPointer = e.pointerId;
    // The text field sits over its box and takes its own taps; a tap anywhere else closes the keyboard.
    if (this.textBox && !hit(this.textBox.zone)) this.textBox.field.blur();
    for (const s of this.shopZones) {
      if (hit(s.zone)) {
        this.buys.push(s.item);
        return;
      }
    }
    if (hit(this.warpButton)) {
      this.presses.add('warp');
      return;
    }
    if (hit(this.missileButton)) {
      this.presses.add('missile');
      return;
    }
    if (hit(this.mineButton)) {
      this.presses.add('mine');
      return;
    }
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
    if (e.pointerId === this.copyPointer) {
      this.copyPointer = null;
      const c = this.copyZone;
      if (c && Math.abs(e.clientX - c.zone.x) <= c.zone.hw && Math.abs(e.clientY - c.zone.y) <= c.zone.hh) {
        copyText(c.text).then((ok) => this.presses.add(ok ? 'copied' : 'copyFailed'));
      }
    }
    if (e.pointerId === this.stickPointer) this.endStick();
    if (e.pointerId === this.firePointer) this.firePointer = null;
  }

  private endStick(): void {
    this.stickPointer = null;
    this.stick = null;
  }
}

/**
 * Copy text: the async clipboard API where allowed, else the older copy command (which still works in
 * embedded frames such as itch's that do not grant clipboard permission). Must run inside a user gesture.
 */
function copyText(text: string): Promise<boolean> {
  const legacy = (): boolean => {
    const area = document.createElement('textarea');
    area.value = text;
    area.readOnly = true; // no on-screen keyboard
    area.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0;font-size:16px;';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  };
  // Try the old way first while the gesture is certainly still active, then the async API.
  if (legacy()) return Promise.resolve(true);
  if (!navigator.clipboard?.writeText) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

export const intents = new Intents();
