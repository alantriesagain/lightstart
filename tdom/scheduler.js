/**
 * @bootstrapp/light/tdom/scheduler: one frame per setImmediate tick. Views
 * flush first, then the renderer lays out and paints; both register
 * through `onFlush` in that order. The terminal's requestAnimationFrame.
 */

class FlushStep {
  /**
   * @param {number} order
   * @param {() => void} fn
   */
  constructor(order, fn) {
    this.order = order;
    this.fn = fn;
  }
}

export const FLUSH_VIEWS = 0;
export const FLUSH_RENDER = 10;
export const FLUSH_AFTER = 20;

export class FrameScheduler {
  constructor() {
    this.requested = false;
    this.flushing = false;
    /** @type {FlushStep[]} */
    this.flushers = [];
    /** @type {(() => void)[]} */
    this.waiters = [];
    this.frames = 0;
  }

  /**
   * Register a flush step at `order` (lower runs first); answers its remover.
   * @param {() => void} fn
   * @param {number} order
   */
  onFlush(fn, order) {
    const step = new FlushStep(order, fn);
    this.flushers.push(step);
    this.flushers.sort(
      /**
       * @param {FlushStep} a
       * @param {FlushStep} b
       */
      (a, b) => a.order - b.order,
    );
    return () => {
      this.flushers = this.flushers.filter((s) => s !== step);
    };
  }

  request() {
    if (this.requested) return;
    this.requested = true;
    setImmediate(() => this.flush());
  }

  flush() {
    this.requested = false;
    if (this.flushing) {
      this.request();
      return;
    }
    this.flushing = true;
    try {
      for (const s of this.flushers.slice()) s.fn();
    } finally {
      this.flushing = false;
    }
    this.frames++;
    const w = this.waiters;
    this.waiters = [];
    for (const resolve of w) resolve();
  }

  /** @returns {Promise<void>} resolves after the next frame has flushed */
  nextFrame() {
    this.request();
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

export const frames = new FrameScheduler();
