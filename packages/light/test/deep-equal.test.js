import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual as nodeStrict } from "node:util";
import { runInNewContext } from "node:vm";
import { isDeepEqual, isDeepStrictEqual } from "./deep-equal.js";

const label = (/** @type {unknown} */ value) => {
  try {
    return typeof value === "bigint" ? `${value}n` : JSON.stringify(value) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const agrees = (/** @type {unknown} */ a, /** @type {unknown} */ b) => {
  const ours = isDeepStrictEqual(a, b);
  const theirs = nodeStrict(a, b);
  assert.equal(ours, theirs, `disagreed on ${label(a)} vs ${label(b)}: ours=${ours} node=${theirs}`);
};

const both = (/** @type {unknown} */ a, /** @type {unknown} */ b) => { agrees(a, b); agrees(b, a); };

test("primitives, NaN and signed zero", () => {
  both(1, 1);
  both(1, 2);
  both(1, "1");
  both(NaN, NaN);
  both(0, -0);
  both(0, 0);
  both(null, undefined);
  both(null, null);
  both(Symbol.for("x"), Symbol.for("x"));
  both(Symbol("x"), Symbol("x"));
  both(10n, 10n);
  both(10n, 11n);
  both(10n, 10);
});

test("plain objects: key order, extra keys, undefined values", () => {
  both({ a: 1, b: 2 }, { b: 2, a: 1 });
  both({ a: 1 }, { a: 1, b: 2 });
  both({ a: 1, b: undefined }, { a: 1 });
  both({ a: 1, b: undefined }, { a: 1, b: undefined });
  both({ a: undefined }, { b: undefined });
  both({}, {});
});

test("prototypes and class identity", () => {
  class Foo { constructor() { this.x = 1; } }
  class Bar { constructor() { this.x = 1; } }
  both(new Foo(), { x: 1 });
  both(new Foo(), new Foo());
  both(new Foo(), new Bar());
  both(Object.create(null), {});
  const withProto = Object.create({ inherited: 1 });
  withProto.own = 2;
  both(withProto, { own: 2 });
});

test("arrays, holes and extra properties", () => {
  both([1, 2, 3], [1, 2, 3]);
  both([1, 2], [1, 2, 3]);
  both([undefined], [undefined]);
  both([, 1], [undefined, 1]);
  both([, 1], [, 1]);
  const tagged = /** @type {number[] & { extra?: string }} */ ([1, 2]);
  tagged.extra = "x";
  both(tagged, [1, 2]);
  both([[1, [2]]], [[1, [2]]]);
  both([[1, [2]]], [[1, [3]]]);
});

test("symbol keys", () => {
  const key = Symbol("k");
  both({ [key]: 1 }, { [key]: 1 });
  both({ [key]: 1 }, { [key]: 2 });
  both({ [key]: 1 }, {});
  const nonEnumerable = {};
  Object.defineProperty(nonEnumerable, key, { value: 1, enumerable: false });
  both(nonEnumerable, {});
});

test("non-enumerable properties are ignored", () => {
  const hidden = { visible: 1 };
  Object.defineProperty(hidden, "secret", { value: 2, enumerable: false });
  both(hidden, { visible: 1 });
});

test("Date, RegExp", () => {
  both(new Date(0), new Date(0));
  both(new Date(0), new Date(1));
  both(new Date(NaN), new Date(NaN));
  both(new Date(0), 0);
  both(/a/g, /a/g);
  both(/a/g, /a/i);
  both(/a/g, /b/g);
});

test("Error name, message, cause and own properties", () => {
  both(new Error("boom"), new Error("boom"));
  both(new Error("boom"), new Error("bang"));
  both(new TypeError("boom"), new Error("boom"));
  both(new Error("boom", { cause: 1 }), new Error("boom", { cause: 1 }));
  both(new Error("boom", { cause: 1 }), new Error("boom", { cause: 2 }));
  both(new Error("boom", { cause: 1 }), new Error("boom"));
  const tagged = /** @type {Error & { code?: string }} */ (new Error("boom"));
  tagged.code = "E1";
  both(tagged, new Error("boom"));
});

test("Map: size, primitive keys, object keys unordered", () => {
  both(new Map([["a", 1]]), new Map([["a", 1]]));
  both(new Map([["a", 1]]), new Map([["a", 2]]));
  both(new Map([["a", 1], ["b", 2]]), new Map([["b", 2], ["a", 1]]));
  both(new Map([["a", 1]]), new Map());
  both(new Map([[{ k: 1 }, "v"]]), new Map([[{ k: 1 }, "v"]]));
  both(new Map([[{ k: 1 }, "v"]]), new Map([[{ k: 2 }, "v"]]));
  both(new Map([[{ k: 1 }, "v"]]), new Map([[{ k: 1 }, "w"]]));
  both(new Map([[NaN, 1]]), new Map([[NaN, 1]]));
  both(new Map(), new Map());
});

test("Set: size, primitives, objects unordered", () => {
  both(new Set([1, 2]), new Set([2, 1]));
  both(new Set([1]), new Set([1, 2]));
  both(new Set([{ a: 1 }]), new Set([{ a: 1 }]));
  both(new Set([{ a: 1 }]), new Set([{ a: 2 }]));
  both(new Set([{ a: 1 }, { b: 2 }]), new Set([{ b: 2 }, { a: 1 }]));
  both(new Set(), new Set());
});

test("typed arrays, ArrayBuffer and DataView", () => {
  both(new Uint8Array([1, 2]), new Uint8Array([1, 2]));
  both(new Uint8Array([1, 2]), new Uint8Array([1, 3]));
  both(new Uint8Array([1]), new Int8Array([1]));
  both(new Float64Array([NaN]), new Float64Array([NaN]));
  both(new Float64Array([0]), new Float64Array([-0]));
  both(new Uint8Array([1, 2]).buffer, new Uint8Array([1, 2]).buffer);
  both(new Uint8Array([1, 2]).buffer, new Uint8Array([1, 3]).buffer);
  both(new DataView(new Uint8Array([1]).buffer), new DataView(new Uint8Array([2]).buffer));
  both(new DataView(new Uint8Array([1]).buffer), new DataView(new Uint8Array([1]).buffer));
  both(new Uint8Array([]), new Uint8Array([]));
});

test("boxed primitives", () => {
  both(new Number(1), new Number(1));
  both(new Number(1), new Number(2));
  both(new Number(1), 1);
  both(new String("a"), new String("a"));
  both(new Boolean(true), new Boolean(true));
  both(new Number(NaN), new Number(NaN));
});

test("functions compare by identity", () => {
  const fn = () => {};
  both(fn, fn);
  both(() => {}, () => {});
  both({ fn }, { fn });
});

test("circular structures", () => {
  /** @type {{ name: string, self?: unknown }} */
  const a = { name: "a" };
  a.self = a;
  /** @type {{ name: string, self?: unknown }} */
  const b = { name: "a" };
  b.self = b;
  both(a, b);

  /** @type {{ name: string, self?: unknown }} */
  const c = { name: "c" };
  c.self = c;
  both(a, c);

  /** @type {{ x: number, peer?: unknown }} */
  const left = { x: 1 };
  /** @type {{ x: number, peer?: unknown }} */
  const right = { x: 1 };
  left.peer = right;
  right.peer = left;
  both(left, right);

  /** @type {unknown[]} */
  const listA = [1];
  listA.push(listA);
  /** @type {unknown[]} */
  const listB = [1];
  listB.push(listB);
  both(listA, listB);
});

test("deeply nested mixed structures", () => {
  const build = (/** @type {unknown} */ leaf) => ({
    list: [1, { set: new Set([1, 2]), map: new Map([["k", { deep: leaf }]]) }],
    when: new Date(5),
    re: /x/g,
    bytes: new Uint8Array([9]),
  });
  both(build("same"), build("same"));
  both(build("a"), build("b"));
});

const shapes = (/** @type {number} */ seed) => {
  const pick = (/** @type {number} */ n) => (seed * 2654435761) % n;
  const leaves = [0, -0, NaN, 1, "1", true, null, undefined, 10n, Symbol.for("s")];
  const leaf = leaves[pick(leaves.length)];
  return [
    { a: [leaf, { b: new Set([leaf]) }], c: new Map([["k", leaf]]) },
    [new Date(pick(3)), /a/g, new Uint8Array([pick(4)]), { nested: { leaf } }],
    new Map([[{ key: leaf }, [leaf, leaf]]]),
    new Set([{ leaf }, [leaf]]),
  ];
};

test("generated structures agree across every pairing", () => {
  for (let i = 0; i < 40; i++)
    for (let j = 0; j < 40; j++) {
      const left = shapes(i);
      const right = shapes(j);
      for (let k = 0; k < left.length; k++) agrees(left[k], right[k]);
    }
});

test("a value from another realm compares by constructor NAME: the iframe deviation", () => {
  const other = runInNewContext("({ wifi: 1, nested: { list: [1, 2] } })");
  assert.equal(other.constructor === Object, false, "the fixture must really be cross-realm");
  assert.equal(nodeStrict(other, { wifi: 1, nested: { list: [1, 2] } }), false, "node itself refuses this");
  assert.equal(isDeepStrictEqual(other, { wifi: 1, nested: { list: [1, 2] } }), true);
  assert.equal(isDeepStrictEqual(other, { wifi: 2, nested: { list: [1, 2] } }), false, "values still have to match");

  const otherArray = runInNewContext("[1, { a: 2 }]");
  assert.equal(isDeepStrictEqual(otherArray, [1, { a: 2 }]), true);
  assert.equal(isDeepStrictEqual(otherArray, [1, { a: 3 }]), false);

  const otherDate = runInNewContext("new Date(5)");
  assert.equal(isDeepStrictEqual(otherDate, new Date(5)), true);
  assert.equal(isDeepStrictEqual(otherDate, new Date(6)), false);
});

test("the deviation does not blur differently-named kinds", () => {
  class Foo { constructor() { this.x = 1; } }
  class Bar { constructor() { this.x = 1; } }
  assert.equal(isDeepStrictEqual(new Foo(), new Bar()), false);
  assert.equal(isDeepStrictEqual(new Foo(), { x: 1 }), false);
  assert.equal(isDeepStrictEqual(Object.create(null), {}), false);
  assert.equal(isDeepStrictEqual(new Uint8Array([1]), new Int8Array([1])), false);
});

test("loose isDeepEqual relaxes prototypes and coerces primitives", () => {
  class Foo { constructor() { this.x = 1; } }
  assert.equal(isDeepEqual(new Foo(), { x: 1 }), true);
  assert.equal(isDeepStrictEqual(new Foo(), { x: 1 }), false);
  assert.equal(isDeepEqual({ a: 1 }, { a: "1" }), true);
  assert.equal(isDeepStrictEqual({ a: 1 }, { a: "1" }), false);
  assert.equal(isDeepEqual([1, 2], [1, 2]), true);
  assert.equal(isDeepEqual({ a: 1 }, { a: 2 }), false);
});
