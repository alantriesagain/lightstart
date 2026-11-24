import assert from "node:assert/strict";
import test from "node:test";
import T, { isReactive, cloneDefault, startOf } from "./index.js";

test("createType: reactive:false forces attribute:false + persist:false", () => {
  const p = T.string({ reactive: false });
  assert.equal(p.attribute, false);
  assert.equal(p.persist, false);
  assert.equal(isReactive(p), false);
  assert.equal(isReactive(T.string()), true);
});

test("createType: reactive:false rejects reactivity-only options", () => {
  for (const bad of [{ sync: "local" }, { query: {} }, { getter: () => 1 }, { setter: () => {} }, { hasChanged: () => true }])
    assert.throws(() => T.object({ reactive: false, ...bad }), /reactive:false/);
});

test("cloneDefault: factory invoked per call, object cloned, primitive as-is", () => {
  const a = cloneDefault(T.object({ reactive: false, defaultValue: () => new Map() }));
  const b = cloneDefault(T.object({ reactive: false, defaultValue: () => new Map() }));
  assert.ok(a instanceof Map && b instanceof Map && a !== b);
  assert.equal(cloneDefault(T.object({ reactive: false, defaultValue: null })), null);
});

test("startOf: a factory is called, an object is shared, a T.function default is the function", () => {
  const made = startOf(T.object({ defaultValue: () => new Set([1]) }));
  assert.ok(made instanceof Set && made.has(1));
  const shared = { a: 1 };
  assert.equal(startOf(T.object({ defaultValue: shared })), shared);
  const fn = () => "kept";
  assert.equal(startOf(T.function({ defaultValue: fn })), fn);
  assert.equal(cloneDefault(T.function({ reactive: false, defaultValue: fn })), fn);
});
