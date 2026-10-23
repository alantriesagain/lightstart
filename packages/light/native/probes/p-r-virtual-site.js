/**
 * @file Probe R: what makes a class family slow natively. The same base and subclass four times
 * over: (a) a base method called through a base-typed array; (b) the same method called through a
 * subclass-typed array; (c) the method never called; (d) the method overridden and called through
 * the base. Allocation and a field write are timed for each, with --time.
 */

class NA {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}
class EA extends NA {
  constructor() {
    super();
    this.tag = "e";
  }
}

class NB {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}
class EB extends NB {
  constructor() {
    super();
    this.tag = "e";
  }
}

class NC {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}
class EC extends NC {
  constructor() {
    super();
    this.tag = "e";
  }
}

class ND {
  constructor() {
    this.x = 0;
  }

  bump() {
    this.x++;
  }
}
class ED extends ND {
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

/** @type {NA[]} */
const a = [];
time("a base-typed call site: alloc 100k", () => {
  for (let i = 0; i < N; i++) a.push(new EA());
});
time("a base-typed call site: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) a[i % N].x = i;
});
time("a base-typed call site: call 1M", () => {
  for (let i = 0; i < 1000000; i++) a[i % N].bump();
});

/** @type {EB[]} */
const b = [];
time("b subclass-typed call site: alloc 100k", () => {
  for (let i = 0; i < N; i++) b.push(new EB());
});
time("b subclass-typed call site: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) b[i % N].x = i;
});
time("b subclass-typed call site: call 1M", () => {
  for (let i = 0; i < 1000000; i++) b[i % N].bump();
});

/** @type {NC[]} */
const c = [];
time("c never called: alloc 100k", () => {
  for (let i = 0; i < N; i++) c.push(new EC());
});
time("c never called: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) c[i % N].x = i;
});

/** @type {ND[]} */
const d = [];
time("d override, base-typed call site: alloc 100k", () => {
  for (let i = 0; i < N; i++) d.push(new ED());
});
time("d override, base-typed call site: field write 1M", () => {
  for (let i = 0; i < 1000000; i++) d[i % N].x = i;
});
time("d override, base-typed call site: call 1M", () => {
  for (let i = 0; i < 1000000; i++) d[i % N].bump();
});
console.log("done", a.length + b.length + c.length + d.length === 4 * N);

export {};
