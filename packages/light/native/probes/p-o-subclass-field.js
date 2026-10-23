/**
 * @file Probe O: a base class whose field is typed with a subclass declared later (`parent:
 * Element | null` on Node), against one typed with itself. Allocation, a field write through a
 * base-typed variable, a virtual call through a base-typed array, timed natively and under node,
 * printed only with --time so the parity runner sees fixed output.
 */

class NodeA {
  constructor() {
    /** @type {ElementA | null} */
    this.parent = null;
    this.x = 0;
    this.version = 0;
  }

  bump() {
    this.version++;
  }
}

class ElementA extends NodeA {
  /** @param {string} tag */
  constructor(tag) {
    super();
    this.tag = tag;
    /** @type {NodeA[]} */
    this.children = [];
  }

  bump() {
    this.version += 2;
  }
}

class NodeB {
  constructor() {
    /** @type {NodeB | null} */
    this.parent = null;
    this.x = 0;
    this.version = 0;
  }

  bump() {
    this.version++;
  }
}

class ElementB extends NodeB {
  /** @param {string} tag */
  constructor(tag) {
    super();
    this.tag = tag;
    /** @type {NodeB[]} */
    this.children = [];
  }

  bump() {
    this.version += 2;
  }
}

const timing = process.argv.includes("--time");
/**
 * @param {string} name
 * @param {() => void} fn
 */
const time = (name, fn) => {
  const t0 = performance.now();
  fn();
  if (timing) console.log(name + ": " + (performance.now() - t0).toFixed(1) + " ms");
};

const N = 100000;
/** @type {NodeA[]} */
const as = [];
/** @type {NodeB[]} */
const bs = [];
time("A alloc 100k (field typed with subclass)", () => {
  for (let i = 0; i < N; i++) as.push(new ElementA("x"));
});
time("B alloc 100k (field typed with itself)", () => {
  for (let i = 0; i < N; i++) bs.push(new ElementB("x"));
});
time("A field write through base 1M", () => {
  for (let i = 0; i < 1000000; i++) as[i % N].x = i;
});
time("B field write through base 1M", () => {
  for (let i = 0; i < 1000000; i++) bs[i % N].x = i;
});
time("A virtual call through base 1M", () => {
  for (let i = 0; i < 1000000; i++) as[i % N].bump();
});
time("B virtual call through base 1M", () => {
  for (let i = 0; i < 1000000; i++) bs[i % N].bump();
});
time("A parent assign 100k", () => {
  const root = new ElementA("root");
  for (let i = 0; i < N; i++) as[i].parent = root;
});
time("B parent assign 100k", () => {
  const root = new ElementB("root");
  for (let i = 0; i < N; i++) bs[i].parent = root;
});
console.log("done", as.length === N && bs.length === N);

export {};
