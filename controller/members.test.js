import assert from "node:assert/strict";
import test from "node:test";
import T from "../types/index.js";
import { defineController } from "./define.js";

const makeCtl = () =>
  defineController({
    name: "demo",
    props: { count: 0 },
    rows: /** @type {Map<string, number>} */ (new Map()),
    res: null,
    connected() { this.rows.set("a", 1); },
  });

test("a plain field member is not a store key, absent from snapshot", () => {
  const inst = makeCtl();
  assert.deepEqual(inst.$state.keys(), ["count"]);
  assert.deepEqual(Object.keys(inst.$state.snapshot()), ["count"]);
  inst.dispose();
});

test("a plain field member is fresh per instance", () => {
  const ctrl = makeCtl();
  const first = ctrl.rows;
  assert.ok(first instanceof Map);
  assert.equal(ctrl.res, null);
  assert.equal(first.get("a"), 1);
  ctrl.dispose();
  assert.notEqual(ctrl.rows, first);
  assert.equal(ctrl.rows.get("a"), 1);
  ctrl.dispose();
});

test("attach subscribes only store keys: mutating a plain field fires no $requestUpdate", () => {
  const inst = makeCtl();
  let renders = 0;
  inst.$attach({ $requestUpdate: () => renders++ });
  inst.rows.set("z", 9);
  assert.equal(renders, 0);
  inst.count = 5;
  assert.equal(renders, 1);
  inst.dispose();
});

test("a controller refuses reactive:false in props", () => {
  assert.throws(
    () => defineController({ name: "bad", props: { x: T.any({ reactive: false, defaultValue: null }) } }),
    /a plain field is a member/,
  );
});
