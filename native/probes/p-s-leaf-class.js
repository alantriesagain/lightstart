/**
 * @file Probe S: a class with a method and no subclass, its method called 1M times, against the
 * same class with a subclass that is never instantiated, and one that is. Timed with --time.
 */

class Alone {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}

class Parent {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}
class Child extends Parent {
  constructor() {
    super();
    this.tag = "c";
  }
}

class Parent2 {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}
class Child2 extends Parent2 {
  constructor() {
    super();
    this.tag = "c";
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

/** @type {Alone[]} */
const a = [];
time("alone: alloc 100k", () => {
  for (let i = 0; i < N; i++) a.push(new Alone());
});
time("alone: call 1M", () => {
  for (let i = 0; i < 1000000; i++) a[i % N].bump();
});

/** @type {Parent[]} */
const p = [];
time("parent only instantiated, subclass declared: alloc 100k", () => {
  for (let i = 0; i < N; i++) p.push(new Parent());
});
time("parent only instantiated, subclass declared: call 1M", () => {
  for (let i = 0; i < 1000000; i++) p[i % N].bump();
});

/** @type {Parent2[]} */
const q = [];
time("parent and child instantiated: alloc 100k", () => {
  for (let i = 0; i < N; i++) q.push(i % 2 === 0 ? new Parent2() : new Child2());
});
time("parent and child instantiated: call 1M", () => {
  for (let i = 0; i < 1000000; i++) q[i % N].bump();
});
console.log("done", a.length + p.length + q.length === 3 * N);

export {};
