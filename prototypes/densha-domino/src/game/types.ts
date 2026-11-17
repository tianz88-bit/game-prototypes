export type Axis = 'h' | 'v';

/** Things on the board that never move. All of them block trains. */
export type ObstacleKind = 'concrete' | 'kiosk' | 'signal' | 'tree' | 'machine' | 'buffer';

export interface TrainDef {
  id: number;
  /** Letter used in the level text. */
  letter: string;
  color: number;
  axis: Axis;
  /** Row (axis h) or column (axis v) of the track the train sits on. */
  line: number;
  /** Start cell along the axis at level start. */
  start: number;
  len: number;
}

export interface Level {
  name: string;
  cols: number;
  rows: number;
  /** Cell index (row * cols + col) -> obstacle. */
  obstacles: Map<number, ObstacleKind>;
  trains: TrainDef[];
}

/** Dynamic part of a level: where each train starts, or -1 once it has left the board. */
export type State = number[];

export const GONE = -1;
export type Dir = -1 | 1;

export interface Move {
  train: number;
  dir: Dir;
}

/** One step of what happened during a tap, in order, for the scene to animate. */
export type TapEvent =
  /** A train moves from `from` to `to` (start cells along its axis). `exited` means it leaves the board. */
  | { type: 'run'; train: number; from: number; to: number; exited: boolean; dir: Dir; link: number; resume: boolean }
  /** A running train stops against another and blows its horn. `spooked` means the other train takes off. */
  | { type: 'hit'; runner: number; target: number; dir: Dir; spooked: boolean; sameLine: boolean; link: number };

export interface TapResult {
  state: State;
  events: TapEvent[];
  /** Number of trains that ran, counting the tapped one. */
  links: number;
  exited: number;
}
