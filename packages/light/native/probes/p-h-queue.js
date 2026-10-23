/**
 * @file Probe H: what the view core's update queue needs natively. A Promise resolved from a
 * field-held resolver and awaited, a Map of instances to depths driving Array.prototype.sort with
 * a comparator, try/finally around a loop, a config class with function fields replaced by a
 * Partial record, a Reactive-like node holding its owner, and Set membership during a flush.
 */

class Config {
  constructor() {
    /** @type {(label: string) => (() => void) | null} */
    this.track = (_label) => null;
    this.dev = true;
  }
}
const config = new Config();

/** @param {{ track?: (label: string) => (() => void) | null, dev?: boolean }} options */
const configureView = (options) => {
  if (options.track !== undefined) config.track = options.track;
  if (options.dev !== undefined) config.dev = options.dev;
};

class Node {
  /** @param {Node | null} parent */
  constructor(parent) {
    this.parent = parent;
  }
}

/** @param {Node} node */
const depthOf = (node) => {
  let depth = 0;
  for (let p = node.parent; p !== null; p = p.parent) depth++;
  return depth;
};

class Updatable {
  /**
   * @param {Node} node
   * @param {string} label
   */
  constructor(node, label) {
    this.node = node;
    this.label = label;
    /** @type {Promise<void> | null} */
    this.promise = null;
    /** @type {(() => void) | null} */
    this.resolve = null;
    /** @type {(() => void) | null} */
    this.done = null;
    this.runs = 0;
  }

  schedule() {
    if (this.promise !== null) return this.promise;
    this.done = config.track("view:" + this.label);
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
    enqueue(this);
    return this.promise;
  }

  flush() {
    this.runs++;
    const resolve = this.resolve;
    const done = this.done;
    this.promise = null;
    this.resolve = null;
    this.done = null;
    if (resolve !== null) resolve();
    if (done !== null) done();
  }
}

/** @type {Updatable[]} */
let queue = [];
/** @type {Updatable[] | null} */
let flushing = null;
/** @type {string[]} */
const order = [];

const flushAll = () => {
  const batch = queue;
  queue = [];
  if (batch.length > 1) {
    /** @type {Map<Updatable, number>} */
    const depths = new Map();
    for (const u of batch) depths.set(u, depthOf(u.node));
    batch.sort(
      /**
       * @param {Updatable} x
       * @param {Updatable} y
       */
      (x, y) => (depths.get(x) ?? 0) - (depths.get(y) ?? 0),
    );
  }
  /** @type {Set<Updatable>} */
  const updated = new Set();
  flushing = batch;
  try {
    for (const u of batch)
      if (updated.has(u)) queue.push(u);
      else {
        updated.add(u);
        order.push(u.label);
        u.flush();
      }
  } finally {
    flushing = null;
  }
  if (queue.length > 0) flushAll();
};

/** @param {Updatable} u */
const enqueue = (u) => {
  if (flushing !== null) flushing.push(u);
  else queue.push(u);
};

/** @type {string[]} */
const tracked = [];
configureView({ track: (label) => () => { tracked.push(label); }, dev: false });

const root = new Node(null);
const mid = new Node(root);
const leaf = new Node(mid);
const c = new Updatable(leaf, "leaf");
const b = new Updatable(mid, "mid");
const a = new Updatable(root, "root");
const p1 = c.schedule();
const p2 = b.schedule();
const p3 = a.schedule();
const same = c.schedule() === p1;
let resolved = 0;
const all = Promise.all([p1, p2, p3]).then(() => {
  resolved = 3;
});
setTimeout(() => {
  flushAll();
  all.then(() => {
    console.log(order.join(","), tracked.join(","), same, resolved, a.runs + b.runs + c.runs, config.dev);
    b.schedule();
    flushAll();
    console.log(order.join(","), b.runs);
  });
}, 0);

export {};
