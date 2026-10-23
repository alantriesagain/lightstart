/**
 * @file Probe N: what an allocation costs natively. 100k instances each of a one-field class, a
 * seven-field class, a three-level subclass, an object literal, a small array and a string, timed.
 */

class One {
  /** @param {number} a */
  constructor(a) {
    this.a = a;
  }
}

class Seven {
  /** @param {number} a */
  constructor(a) {
    this.a = a;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.f = 0;
    /** @type {Seven | null} */
    this.parent = null;
  }
}

class Base {
  constructor() {
    this.x = 0;
    this.y = 0;
    /** @type {Base | null} */
    this.parent = null;
  }
}

class Mid extends Base {
  /** @param {string} tag */
  constructor(tag) {
    super();
    this.tag = tag;
    /** @type {Base[]} */
    this.children = [];
  }
}

class Leaf extends Mid {
  /** @param {string} tag */
  constructor(tag) {
    super(tag);
    this.flex = 0;
  }
}

/**
 * @param {string} name
 * @param {() => void} fn
 */
const time = (name, fn) => {
  const t0 = performance.now();
  fn();
  console.log(name + ": " + (performance.now() - t0).toFixed(1) + " ms");
};

const N = 100000;
time("one-field class", () => {
  /** @type {One[]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push(new One(i));
});
time("seven-field class", () => {
  /** @type {Seven[]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push(new Seven(i));
});
time("three-level subclass with an array field", () => {
  /** @type {Leaf[]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push(new Leaf("x"));
});
time("two-level subclass with an array field", () => {
  /** @type {Mid[]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push(new Mid("x"));
});
time("object literal", () => {
  /** @type {{ a: number, b: number }[]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push({ a: i, b: 0 });
});
time("small array", () => {
  /** @type {number[][]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push([i, 0, 0]);
});
time("one-field class, dropped", () => {
  let sum = 0;
  for (let i = 0; i < N; i++) sum += new One(i).a;
  if (sum < 0) throw new Error("x");
});
time("empty array field only", () => {
  /** @type {number[][]} */
  const keep = [];
  for (let i = 0; i < N; i++) keep.push([]);
});

export {};
