/**
 * @file Probe P: does a method overridden in a subclass make every instance of the family
 * expensive natively? Four families with the same fields: no methods; a method on the base only;
 * a method the subclass adds under another name; a method the subclass overrides. Allocation and
 * a field write through a base-typed array, timed with --time.
 */

class N0 {
  constructor() {
    this.x = 0;
    /** @type {N0 | null} */
    this.parent = null;
  }
}
class E0 extends N0 {
  constructor() {
    super();
    this.tag = "e";
  }
}

class N1 {
  constructor() {
    this.x = 0;
    /** @type {N1 | null} */
    this.parent = null;
  }

  bump() {
    this.x++;
  }
}
class E1 extends N1 {
  constructor() {
    super();
    this.tag = "e";
  }
}

class N2 {
  constructor() {
    this.x = 0;
    /** @type {N2 | null} */
    this.parent = null;
  }

  bump() {
    this.x++;
  }
}
class E2 extends N2 {
  constructor() {
    super();
    this.tag = "e";
  }

  bumpMore() {
    this.x += 2;
  }
}

class N3 {
  constructor() {
    this.x = 0;
    /** @type {N3 | null} */
    this.parent = null;
  }

  bump() {
    this.x++;
  }
}
class E3 extends N3 {
  constructor() {
    super();
    this.tag = "e";
  }

  bump() {
    this.x += 2;
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

/** @type {N0[]} */
const a0 = [];
time("0 no methods: alloc 100k", () => {
  for (let i = 0; i < N; i++) a0.push(new E0());
});
time("0 no methods: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) a0[i % N].x = i;
});
/** @type {N1[]} */
const a1 = [];
time("1 base method: alloc 100k", () => {
  for (let i = 0; i < N; i++) a1.push(new E1());
});
time("1 base method: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) a1[i % N].x = i;
});
time("1 base method: call 1M", () => {
  for (let i = 0; i < 1000000; i++) a1[i % N].bump();
});
/** @type {N2[]} */
const a2 = [];
time("2 added method: alloc 100k", () => {
  for (let i = 0; i < N; i++) a2.push(new E2());
});
time("2 added method: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) a2[i % N].x = i;
});
/** @type {N3[]} */
const a3 = [];
time("3 override: alloc 100k", () => {
  for (let i = 0; i < N; i++) a3.push(new E3());
});
time("3 override: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) a3[i % N].x = i;
});
time("3 override: call 1M", () => {
  for (let i = 0; i < 1000000; i++) a3[i % N].bump();
});
console.log("done", a0.length + a1.length + a2.length + a3.length === 4 * N);

export {};
