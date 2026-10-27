/**
 * Global pending-work tracker: the route-settle contract. Async producers
 * (worker requests, lazy component loads, resource fetches) register their
 * in-flight work; the build crawler awaits `whenIdle` instead of guessing
 * from DOM mutations. Idle means zero pending work held across N consecutive
 * frame flushes (a fixpoint over render/fetch/render cascades, since work
 * spawned by a render is tracked within its own frame).
 */

const FRAME_WATCHDOG_MS = 250;

const defaultNextFrame = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function" ||
        (typeof document !== "undefined" && document.visibilityState === "hidden"))
      return void setTimeout(resolve, 0);
    const watchdog = setTimeout(resolve, FRAME_WATCHDOG_MS);
    requestAnimationFrame(() => {
      clearTimeout(watchdog);
      resolve(undefined);
    });
  });

/** @param {string[]} labels */
export const summarize = (labels) => {
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label))
    .join(", ");
};

/**
 * @param {{ nextFrame?: () => Promise<unknown> }} [options]
 * @returns {import("./types.js").SettleTracker}
 */
export const createSettle = ({ nextFrame = defaultNextFrame } = {}) => {
  const entries = new Map();
  let nextId = 0;
  let generation = 0;

  const track = (/** @type {string} */ label) => {
    const id = nextId++;
    entries.set(id, label);
    generation++;
    return () => {
      if (entries.delete(id)) generation++;
    };
  };

  /**
   * @template T
   * @param {Promise<T> | T} promise
   * @param {string} label
   */
  const wrap = (promise, label) => {
    const done = track(label);
    return Promise.resolve(promise).finally(done);
  };

  const count = () => entries.size;
  const inflight = () => [...entries.values()];

  const whenIdle = async (/** @type {{ confirmFrames?: number, timeout?: number }} */ { confirmFrames = 2, timeout } = {}) => {
    const start = Date.now();
    for (;;) {
      if (timeout !== undefined && Date.now() - start >= timeout)
        throw new Error(`settle: still pending after ${timeout}ms: ${summarize(inflight()) || "(work churned through the confirmation window)"}`);
      if (entries.size > 0) {
        await nextFrame();
        continue;
      }
      const before = generation;
      let confirmed = true;
      for (let i = 0; i < confirmFrames; i++) {
        await nextFrame();
        if (generation !== before) {
          confirmed = false;
          break;
        }
      }
      if (confirmed) return;
    }
  };

  return { track, wrap, count, inflight, whenIdle };
};
