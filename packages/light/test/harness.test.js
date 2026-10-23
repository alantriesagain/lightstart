import assert from "node:assert/strict";
import test from "node:test";
import { _watchUncaught, attachAssert, registerHook, registerSuite, registerTest, reset, run } from "./harness.js";
import strictAssert from "./node-assert-strict.js";

/** @import { TestContext, TestResult } from "./types.ts" */

attachAssert(strictAssert);

/** @param {TestResult} result @returns {Error} */
const errorOf = (result) => {
  assert.ok(result.error, `expected "${result.name.join(" > ")}" to have failed`);
  return result.error;
};

/** @param {TestResult[]} results @returns {Record<string, string>} */
const statuses = (results) => Object.fromEntries(results.map((r) => [r.name.join(" > "), r.status]));

test("hooks fire in node's order across three nesting levels", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("outer", () => {
    registerHook("before", () => log.push("before:outer"));
    registerHook("after", () => log.push("after:outer"));
    registerHook("beforeEach", () => log.push("beforeEach:outer"));
    registerHook("afterEach", () => log.push("afterEach:outer"));
    registerSuite("middle", () => {
      registerHook("before", () => log.push("before:middle"));
      registerHook("after", () => log.push("after:middle"));
      registerHook("beforeEach", () => log.push("beforeEach:middle"));
      registerHook("afterEach", () => log.push("afterEach:middle"));
      registerSuite("inner", () => {
        registerHook("beforeEach", () => log.push("beforeEach:inner"));
        registerHook("afterEach", () => log.push("afterEach:inner"));
        registerTest("the test", () => log.push("test"));
      });
    });
  });
  await run();

  assert.deepEqual(log, [
    "before:outer",
    "before:middle",
    "beforeEach:outer",
    "beforeEach:middle",
    "beforeEach:inner",
    "test",
    "afterEach:inner",
    "afterEach:middle",
    "afterEach:outer",
    "after:middle",
    "after:outer",
  ]);
});

test("a parent's afterEach fires for a nested test: the bug the old engine had", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("parent", () => {
    registerHook("afterEach", () => log.push("parent-cleanup"));
    registerSuite("child", () => {
      registerTest("t", () => log.push("test"));
    });
  });
  await run();
  assert.deepEqual(log, ["test", "parent-cleanup"]);
});

test("afterEach runs even when the test throws: the other bug", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("s", () => {
    registerHook("afterEach", () => log.push("cleanup"));
    registerTest("failing", () => { throw new Error("boom"); });
  });
  const { results, counts } = await run();
  assert.deepEqual(log, ["cleanup"], "cleanup must run for a failed test");
  assert.equal(counts.fail, 1);
  assert.equal(errorOf(results[0]).message, "boom");
});

test("nesting is real, not flattened", async () => {
  reset();
  registerSuite("a", () => {
    registerSuite("b", () => {
      registerTest("deep", () => {});
    });
    registerTest("shallow", () => {});
  });
  const { results, counts } = await run();
  assert.deepEqual(results.map((r) => r.name), [["a", "b", "deep"], ["a", "shallow"]]);
  assert.equal(counts.suites, 2);
});

test("suite-level hooks accumulate instead of last-wins", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("s", () => {
    registerHook("beforeEach", () => log.push("one"));
    registerHook("beforeEach", () => log.push("two"));
    registerTest("t", () => {});
  });
  await run();
  assert.deepEqual(log, ["one", "two"]);
});

test("a failing before() fails the whole subtree but still runs after()", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("s", () => {
    registerHook("before", () => { throw new Error("setup failed"); });
    registerHook("after", () => log.push("teardown"));
    registerTest("a", () => log.push("a"));
    registerTest("b", () => log.push("b"));
  });
  const { results, counts } = await run();
  assert.equal(counts.fail, 2);
  assert.equal(errorOf(results[0]).message, "setup failed");
  assert.deepEqual(log, ["teardown"], "bodies skipped, teardown still ran");
});

test("skip and todo are counted, never executed", async () => {
  reset();
  let ran = 0;
  registerSuite("s", () => {
    registerTest("skipped", { skip: true }, () => { ran += 1; });
    registerTest("skipped with reason", { skip: "no DOM" }, () => { ran += 1; });
    registerTest("todo", { todo: true }, () => { ran += 1; });
    registerTest("normal", () => {});
  });
  const { results, counts } = await run();
  assert.equal(ran, 0);
  assert.equal(counts.skip, 2);
  assert.equal(counts.todo, 1);
  assert.equal(counts.pass, 1);
  assert.equal(counts.total, 4);
  assert.equal(results[1].reason, "no DOM");
});

test("a skipped suite skips its subtree and reports as one entry, the way node does", async () => {
  reset();
  let ran = 0;
  registerSuite("s", { skip: true }, () => {
    registerTest("a", () => { ran += 1; });
    registerSuite("nested", () => registerTest("b", () => { ran += 1; }));
  });
  const { counts, results } = await run();
  assert.equal(ran, 0);
  assert.equal(counts.skip, 1);
  assert.equal(results[0].isSuite, true);
  assert.deepEqual(results[0].name, ["s"]);
});

test("a test with no body passes, the way node reports it", async () => {
  reset();
  registerSuite("s", () => registerTest("unimplemented"));
  const { counts } = await run();
  assert.equal(counts.pass, 1);
});

test("only narrows to the marked test, at each level", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("s", () => {
    registerTest("skipped by only", () => log.push("no"));
    registerTest("chosen", { only: true }, () => log.push("yes"));
  });
  const { counts } = await run();
  assert.deepEqual(log, ["yes"]);
  assert.equal(counts.total, 1);
});

test("describe.only keeps its whole subtree", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("kept", { only: true }, () => {
    registerTest("a", () => log.push("a"));
    registerTest("b", () => log.push("b"));
  });
  registerSuite("dropped", () => registerTest("c", () => log.push("c")));
  await run();
  assert.deepEqual(log, ["a", "b"]);
});

test("timeout fails the test and aborts its signal", async () => {
  reset();
  let aborted = false;
  registerSuite("s", () => {
    registerTest("slow", { timeout: 20 }, async (/** @type {TestContext} */ t) => {
      t.signal.addEventListener("abort", () => { aborted = true; });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  });
  const { results, counts } = await run();
  assert.equal(counts.fail, 1);
  assert.match(errorOf(results[0]).message, /timed out after 20ms/);
  assert.equal(aborted, true);
});

test("a test finishing inside its timeout passes", async () => {
  reset();
  registerSuite("s", () => {
    registerTest("quick", { timeout: 500 }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  });
  const { counts } = await run();
  assert.equal(counts.pass, 1);
});

test("concurrency runs siblings together; the default stays serial", async () => {
  reset();
  let peak = 0;
  let active = 0;
  const body = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
  };
  registerSuite("parallel", { concurrency: 3 }, () => {
    for (let i = 0; i < 6; i++) registerTest(`t${i}`, body);
  });
  await run();
  assert.equal(peak > 1, true, "concurrency must overlap");
  assert.equal(peak <= 3, true, "and must respect the limit");

  reset();
  peak = 0;
  active = 0;
  registerSuite("serial", () => {
    for (let i = 0; i < 4; i++) registerTest(`t${i}`, body);
  });
  await run();
  assert.equal(peak, 1, "the default must stay serial");
});

test("a rejected promise fails the test", async () => {
  reset();
  registerSuite("s", () => {
    registerTest("rejects", async () => { await Promise.reject(new Error("nope")); });
  });
  const { results, counts } = await run();
  assert.equal(counts.fail, 1);
  assert.equal(errorOf(results[0]).message, "nope");
});

test("an async describe body is refused loudly", async () => {
  reset();
  registerSuite("s", async () => { registerTest("never", () => {}); });
  const { results, counts } = await run();
  assert.equal(counts.fail, 1);
  assert.match(errorOf(results[0]).message, /async describe callbacks are not supported/);
});

test("a throw during registration fails that suite without killing siblings", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("broken", () => { throw new Error("bad registration"); });
  registerSuite("fine", () => registerTest("t", () => log.push("ran")));
  const { counts } = await run();
  assert.deepEqual(log, ["ran"]);
  assert.equal(counts.pass, 1);
});

test("subtests run and a failing one fails the parent", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerSuite("s", () => {
    registerTest("parent", async (/** @type {TestContext} */ t) => {
      await t.test("child ok", () => log.push("ok"));
      await t.test("child bad", () => { throw new Error("child failed"); });
    });
  });
  const { results, counts } = await run();
  assert.deepEqual(log, ["ok"]);
  assert.equal(counts.fail, 1);
  assert.equal(results[0].subtests.length, 2);
  assert.equal(results[0].subtests[0].status, "pass");
  assert.equal(results[0].subtests[1].status, "fail");
});

test("t.diagnostic, t.skip and t.plan", async () => {
  reset();
  registerSuite("s", () => {
    registerTest("diagnoses", (/** @type {TestContext} */ t) => t.diagnostic("something worth noting"));
    registerTest("skips itself", (/** @type {TestContext} */ t) => { t.skip("not today"); });
    registerTest("meets its plan", (/** @type {TestContext} */ t) => {
      t.plan(2);
      t.assert.ok(true);
      t.assert.equal(1, 1);
    });
    registerTest("misses its plan", (/** @type {TestContext} */ t) => {
      t.plan(3);
      t.assert.ok(true);
    });
  });
  const { results, counts } = await run();
  assert.deepEqual(results[0].diagnostics, ["something worth noting"]);
  assert.equal(results[1].status, "skip");
  assert.equal(results[1].reason, "not today");
  assert.equal(results[2].status, "pass");
  assert.equal(results[3].status, "fail");
  assert.match(errorOf(results[3]).message, /plan expected 3 assertions, 1 ran/);
  assert.equal(counts.fail, 1);
});

test("t.mock is restored after the test", async () => {
  reset();
  const target = { greet: () => "real" };
  registerSuite("s", () => {
    registerTest("mocks", (/** @type {TestContext} */ t) => {
      t.mock.method(target, "greet", () => "fake");
      assert.equal(target.greet(), "fake");
    });
  });
  await run();
  assert.equal(target.greet(), "real", "the mock must be restored when the test ends");
});

test("results carry the full name path and a duration", async () => {
  reset();
  registerSuite("outer", () => registerSuite("inner", () => registerTest("leaf", () => {})));
  const { results } = await run();
  assert.deepEqual(results[0].name, ["outer", "inner", "leaf"]);
  assert.equal(typeof results[0].durationMs, "number");
});

test("top-level tests need no describe", async () => {
  reset();
  registerTest("flat", () => {});
  registerTest("also flat", () => {});
  const { counts, results } = await run();
  assert.equal(counts.pass, 2);
  assert.deepEqual(statuses(results), { flat: "pass", "also flat": "pass" });
});

test("a top-level beforeEach applies to everything", async () => {
  reset();
  /** @type {string[]} */
  const log = [];
  registerHook("beforeEach", () => log.push("root"));
  registerTest("flat", () => log.push("flat"));
  registerSuite("s", () => registerTest("nested", () => log.push("nested")));
  await run();
  assert.deepEqual(log, ["root", "flat", "root", "nested"]);
});

test("a test fails when something raised an error nothing caught", async () => {
  reset();
  const raiser = new EventTarget();
  const detach = _watchUncaught(raiser);
  registerTest("looks fine, is not", () => {
    raiser.dispatchEvent(new ErrorEvent("error", { message: "boom", error: new TypeError("boom") }));
  });
  const { results } = await run();
  detach();
  assert.equal(results[0].status, "fail");
  assert.match(errorOf(results[0]).message, /nothing caught an error during this test/);
  assert.match(errorOf(results[0]).message, /TypeError: boom/);
});

test("an unhandled rejection during a test fails it, and a clean test is unaffected", async () => {
  reset();
  const raiser = new EventTarget();
  const detach = _watchUncaught(raiser);
  registerTest("rejects in the background", () => {
    const event = new Event("unhandledrejection");
    Object.assign(event, { reason: new Error("nobody awaited me") });
    raiser.dispatchEvent(event);
  });
  registerTest("raises nothing", () => {});
  const { results } = await run();
  detach();
  assert.deepEqual(statuses(results), { "rejects in the background": "fail", "raises nothing": "pass" });
  assert.match(errorOf(results[0]).message, /unhandled rejection: nobody awaited me/);
});

test("a ResizeObserver loop notification is not a failure", async () => {
  reset();
  const raiser = new EventTarget();
  const detach = _watchUncaught(raiser);
  registerTest("resizes inside its own observer", () => {
    raiser.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications." }));
  });
  const { results } = await run();
  detach();
  assert.equal(results[0].status, "pass");
});

test("t.before runs once before the first subtest, and a plan option counts assertions", async () => {
  reset();
  const seen = [];
  registerTest("parent", { plan: 2 }, async (t) => {
    t.before(() => seen.push("before"));
    await t.test("one", () => seen.push("one"));
    await t.test("two", () => seen.push("two"));
    t.assert.ok(true);
    t.assert.ok(true);
  });
  registerTest("short plan", { plan: 2 }, (t) => { t.assert.ok(true); });
  const { results } = await run();
  assert.deepEqual(seen, ["before", "one", "two"]);
  assert.equal(results[0].status, "pass");
  assert.equal(results[1].status, "fail");
  assert.match(results[1].error.message, /plan expected 2 assertions, 1 ran/);
});

test("a timeout on a hook or a suite is refused rather than ignored", () => {
  reset();
  assert.throws(() => registerHook("before", () => {}, { timeout: 10 }), /not available in the browser test runner/);
  assert.throws(() => registerSuite("slow", { timeout: 10 }, () => {}), /describe\(\{ timeout \}\)/);
});
