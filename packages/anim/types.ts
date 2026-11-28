/** An easing curve: maps normalized progress to normalized output. Back/bounce/elastic may leave [0,1] mid-flight. */
export type EasingFn = (t: number) => number;

/** Names of the easing curves registered in easing.js. */
export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInBack"
  | "easeOutBack"
  | "easeInOutBack"
  | "easeOutBounce"
  | "easeInBounce"
  | "easeOutElastic";

/** One point of a keyframe channel; `t` is ms relative to the channel's start. `easing` or `bezier` shapes the segment TOWARD the next point. */
export interface KeyframePoint {
  t: number;
  value: number;
  easing?: string;
  bezier?: [number, number, number, number] | number[];
}

/** Damped-spring config for spring.js: baked into KeyframePoint channels, never a runtime primitive. */
export interface SpringConfig {
  from?: number;
  to?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  initialVelocity?: number;
  fps?: number;
  maxDurationMs?: number;
}

export interface TweenConfig {
  from?: number;
  to?: number;
  /** Duration in ms, excluding `delay`. */
  ms?: number;
  easing?: EasingName | string;
  /** Ms to wait before the interpolation begins. */
  delay?: number;
  onUpdate?: (value: number, progress: number) => void;
  onComplete?: (value: number) => void;
}

export interface Tween {
  readonly value: number;
  readonly done: boolean;
  readonly elapsed: number;
  readonly progress: number;
  /** Advance by `dtMs`, returning the new value. */
  step(dtMs: number): number;
  cancel(): void;
  reset(): Tween;
}

export interface Timeline {
  readonly elapsed: number;
  readonly done: boolean;
  /** Schedule `tween` to start `at` ms into the timeline. */
  add(tween: Tween, at?: number): Timeline;
  step(dtMs: number): Timeline;
  cancel(): void;
  reset(): Timeline;
}

export interface LiveSpringConfig {
  value?: number;
  target?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
}

export interface LiveSpring {
  readonly value: number;
  readonly velocity: number;
  readonly target: number;
  readonly atRest: boolean;
  /** Move the goal without disturbing position or velocity. */
  setTarget(next: number): LiveSpring;
  /** Jump to a value, killing velocity. */
  snap(next: number): LiveSpring;
  /** Advance by `dtMs`, returning the new value. */
  step(dtMs: number): number;
}

/** Re-export runtime types from the JS entry so the bare `@lightstart/anim` specifier surfaces both the type-only declarations above AND the JSDoc-inferred types of the runtime exports. */
export * from "./index.js";
