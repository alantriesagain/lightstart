/**
 * @bootstrapp/light/native/tui/ticks: one tick for everything that moves on its
 * own (a spinner, a running clock), four times a second. Every listener runs
 * in the same turn, so what they redraw lands in one frame instead of a frame
 * each; the timer runs while something listens and stops with the last
 * listener. `spinnerAt(now)` is the spinner's frame of the moment, one per
 * tick.
 */

export const TICK_MS = 250;

export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** The spinner's frame at `now`, one per tick. */
export const spinnerAt = (now: number): string => SPINNER[Math.floor(now / TICK_MS) % SPINNER.length];

class Listener {
  readonly fn: () => void;
  on = true;

  constructor(fn: () => void) {
    this.fn = fn;
  }
}

let listeners: Listener[] = [];
let running = false;

const run = (): void => {
  if (listeners.length === 0) {
    running = false;
    return;
  }
  setTimeout(() => {
    for (const l of listeners) if (l.on) l.fn();
    listeners = listeners.filter((l) => l.on);
    run();
  }, TICK_MS).unref();
};

/** Call `fn` on every tick until the function answered is called. */
export const onTick = (fn: () => void): (() => void) => {
  const l = new Listener(fn);
  listeners.push(l);
  if (!running) {
    running = true;
    run();
  }
  return () => {
    l.on = false;
  };
};
