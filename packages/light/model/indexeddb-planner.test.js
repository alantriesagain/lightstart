import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.IDBKeyRange ??= {
  only: (value) => ({ kind: "only", value }),
  bound: (lower, upper, lowerOpen, upperOpen) => ({ kind: "bound", lower, upper, lowerOpen, upperOpen }),
  lowerBound: (value, open) => ({ kind: "lowerBound", value, open }),
  upperBound: (value, open) => ({ kind: "upperBound", value, open }),
};

const { planIndex } = await import("./indexeddb.ts");

const SCHEMA = {
  id: { $type: "string" },
  slug: { $type: "string", index: true },
  dayKey: { $type: "string", index: true },
  areas: { $type: "array", index: true },
  title: { $type: "string" },
  warmup: { $type: "boolean", index: true },
  level: { $type: "number", index: true },
};

test("plans an equality on an indexed field", () => {
  const plan = planIndex(SCHEMA, { slug: "back-squat" });
  assert.deepEqual(plan, { field: "slug", range: { kind: "only", value: "back-squat" }, multiEntry: false });
});

test("plans 'has' on an array field as a multiEntry lookup", () => {
  const plan = planIndex(SCHEMA, { areas: { has: "push" } });
  assert.equal(plan.field, "areas");
  assert.equal(plan.multiEntry, true);
  assert.deepEqual(plan.range, { kind: "only", value: "push" });
});

test("plans a half-open range from a single comparison", () => {
  assert.deepEqual(planIndex(SCHEMA, { dayKey: { ">=": "2026-08-01" } }).range, {
    kind: "lowerBound", value: "2026-08-01", open: false,
  });
  assert.deepEqual(planIndex(SCHEMA, { level: { "<": 3 } }).range, {
    kind: "upperBound", value: 3, open: true,
  });
});

test("plans a bounded range when both ends are given", () => {
  const plan = planIndex(SCHEMA, { dayKey: { ">=": "2026-08-01", "<=": "2026-08-31" } });
  assert.deepEqual(plan.range, {
    kind: "bound", lower: "2026-08-01", upper: "2026-08-31", lowerOpen: false, upperOpen: false,
  });
});

test("declines fields with no index, so those still scan", () => {
  assert.equal(planIndex(SCHEMA, { title: "Workout A" }), null);
});

test("a boolean condition on an indexed boolean becomes its stored 0/1 key", () => {
  assert.equal(planIndex(SCHEMA, { warmup: false })?.range.value, 0);
  assert.equal(planIndex(SCHEMA, { warmup: true })?.range.value, 1);
});

test("declines keys IndexedDB cannot store", () => {
  assert.equal(planIndex(SCHEMA, { slug: null }), null);
  assert.equal(planIndex(SCHEMA, { level: { ">=": Number.NaN } }), null);
});

test("declines operators an index cannot express", () => {
  assert.equal(planIndex(SCHEMA, { slug: { ilike: "squat" } }), null);
  assert.equal(planIndex(SCHEMA, { slug: { "not in": ["a", "b"] } }), null);
});

test("takes the first indexed field it can use and leaves the rest to the filter", () => {
  const plan = planIndex(SCHEMA, { title: "ignored", dayKey: "2026-08-07", slug: "also-indexed" });
  assert.equal(plan.field, "dayKey");
});

test("plans nothing without a where or a schema", () => {
  assert.equal(planIndex(SCHEMA, undefined), null);
  assert.equal(planIndex(null, { slug: "x" }), null);
});
