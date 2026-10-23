import assert from "node:assert/strict";
import test from "node:test";
import { attachAssert, registerSuite, registerTest, reset, run } from "./harness.js";
import strictAssert from "./node-assert-strict.js";
import { loadFailure, toWireFormat } from "./report.js";

/** @import { SerializedError, TestContext, WireResult } from "./types.ts" */

attachAssert(strictAssert);

/** @param {WireResult} entry @returns {SerializedError} */
const errorOf = (entry) => {
  assert.ok(entry.error, `expected "${entry.name.join(" > ")}" to carry an error`);
  return entry.error;
};

/** @param {() => void} register */
const wireOf = async (register) => {
  reset();
  register();
  return toWireFormat(await run(), { file: "/app/x/y.browser.test.js" });
};

test("the wire format survives JSON round-tripping", async () => {
  const wire = await wireOf(() => {
    registerSuite("s", () => {
      registerTest("passes", () => {});
      registerTest("fails", () => strictAssert.equal(1, 2));
      registerTest("skipped", { skip: "no DOM" }, () => {});
    });
  });
  const round = JSON.parse(JSON.stringify(wire));
  assert.deepEqual(round.counts, { pass: 1, fail: 1, skip: 1, todo: 0, total: 3, suites: 1 });
  assert.equal(round.file, "/app/x/y.browser.test.js");
  assert.equal(round.shimLoaded, true);
});

test("a failure carries the name path, operator, diff and stack", async () => {
  const wire = await wireOf(() => {
    registerSuite("outer", () => registerSuite("inner", () => {
      registerTest("compares", () => strictAssert.deepEqual({ count: 2 }, { count: 3 }));
    }));
  });
  const [failure] = wire.failures;
  assert.deepEqual(failure.name, ["outer", "inner", "compares"]);
  assert.equal(errorOf(failure).name, "AssertionError");
  assert.equal(errorOf(failure).operator, "deepStrictEqual");
  assert.equal(String(errorOf(failure).actualText).includes("count: 2"), true);
  assert.equal(String(errorOf(failure).expectedText).includes("count: 3"), true);
  assert.equal((errorOf(failure).diff ?? []).some((line) => line.startsWith("+")), true);
  assert.equal((errorOf(failure).diff ?? []).some((line) => line.startsWith("-")), true);
  assert.equal(Array.isArray(errorOf(failure).stack), true);
  assert.equal(errorOf(failure).stack.length > 0, true, "a real stack must survive");
});

test("a plain thrown Error serializes without operator fields", async () => {
  const wire = await wireOf(() => registerTest("throws", () => { throw new Error("boom"); }));
  const [failure] = wire.failures;
  assert.equal(errorOf(failure).message, "boom");
  assert.equal(errorOf(failure).operator, undefined);
  assert.equal(errorOf(failure).diff, undefined);
});

test("a non-Error throw still reports", async () => {
  const wire = await wireOf(() => registerTest("throws a string", () => { throw "just a string"; }));
  assert.equal(errorOf(wire.failures[0]).message, "just a string");
});

test("diagnostics and skip reasons come through", async () => {
  const wire = await wireOf(() => {
    registerTest("notes", (/** @type {TestContext} */ t) => t.diagnostic("hello"));
    registerTest("skips", { skip: "needs a DOM" }, () => {});
  });
  assert.deepEqual(wire.tests[0].diagnostics, ["hello"]);
  assert.equal(wire.tests[1].reason, "needs a DOM");
});

test("subtests are nested in the report", async () => {
  const wire = await wireOf(() => {
    registerTest("parent", async (/** @type {TestContext} */ t) => {
      await t.test("child", () => {});
    });
  });
  assert.equal(wire.tests[0].subtests.length, 1);
  assert.deepEqual(wire.tests[0].subtests[0].name, ["parent", "child"]);
});

test("loadFailure reports a file that could not be imported", () => {
  const wire = loadFailure("/app/x/y.browser.test.js", new Error("Failed to fetch"), { shimLoaded: false });
  assert.equal(wire.shimLoaded, false);
  assert.equal(wire.counts.fail, 1);
  assert.equal(wire.counts.total, 1);
  assert.ok(wire.loadError);
  assert.equal(wire.loadError.message, "Failed to fetch");
  assert.equal(JSON.parse(JSON.stringify(wire)).loadError.message, "Failed to fetch");
});

test("an empty file reports zero total so the CLI can fail it", async () => {
  const wire = await wireOf(() => {});
  assert.equal(wire.counts.total, 0);
});
