import nodeAssert from "node:assert/strict";
import nodeLoose from "node:assert";
import test from "node:test";
import ours from "./node-assert-strict.js";
import oursLoose from "./node-assert.js";

/** @import { AssertionError } from "./assertion-error.js" */

/**
 * @param {() => unknown} fn
 * @returns {{ threw: boolean, name?: string, code?: string, operator?: string, actual?: unknown, expected?: unknown, message?: string, generatedMessage?: boolean }}
 */
const outcome = (fn) => {
  try {
    fn();
    return { threw: false };
  } catch (thrown) {
    const error = /** @type {AssertionError} */ (thrown);
    return {
      threw: true,
      name: error.name,
      code: error.code,
      operator: error.operator,
      actual: error.actual,
      expected: error.expected,
      message: error.message,
      generatedMessage: error.generatedMessage,
    };
  }
};

/**
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<{ threw: boolean, name?: string, code?: string, operator?: string }>}
 */
const asyncOutcome = async (fn) => {
  try {
    await fn();
    return { threw: false };
  } catch (thrown) {
    const error = /** @type {AssertionError} */ (thrown);
    return { threw: true, name: error.name, code: error.code, operator: error.operator };
  }
};

/** @param {unknown} _t @param {string} method @param {unknown[]} args */
const agree = (_t, method, ...args) => {
  const mine = outcome(() => Reflect.get(ours, method)(...args));
  const theirs = outcome(() => Reflect.get(nodeAssert, method)(...args));
  nodeAssert.equal(mine.threw, theirs.threw, `${method}(${args.map(String).join(", ")}): threw ${mine.threw}, node ${theirs.threw}`);
  if (!theirs.threw) return;
  nodeAssert.equal(mine.name, theirs.name, `${method}: error name`);
  nodeAssert.equal(mine.code, theirs.code, `${method}: error code`);
  nodeAssert.equal(mine.operator, theirs.operator, `${method}: operator`);
  nodeAssert.deepEqual(mine.actual, theirs.actual, `${method}: actual`);
  nodeAssert.deepEqual(mine.expected, theirs.expected, `${method}: expected`);
};

test("equal / strictEqual", () => {
  agree(null, "equal", 1, 1);
  agree(null, "equal", 1, 2);
  agree(null, "equal", 1, "1");
  agree(null, "equal", NaN, NaN);
  agree(null, "equal", 0, -0);
  agree(null, "equal", null, undefined);
  agree(null, "strictEqual", "a", "a");
  agree(null, "strictEqual", "a", "b");
  agree(null, "notEqual", 1, 2);
  agree(null, "notEqual", 1, 1);
  agree(null, "notStrictEqual", 1, 1);
});

test("deepEqual is deep-strict under /strict", () => {
  agree(null, "deepEqual", { a: 1 }, { a: 1 });
  agree(null, "deepEqual", { a: 1, b: 2 }, { b: 2, a: 1 });
  agree(null, "deepEqual", { a: 1 }, { a: "1" });
  agree(null, "deepEqual", [1, undefined], [1, null]);
  agree(null, "deepEqual", { a: undefined }, {});
  agree(null, "deepEqual", new Map([["k", 1]]), new Map([["k", 1]]));
  agree(null, "deepEqual", new Set([1]), new Set([2]));
  agree(null, "notDeepEqual", { a: 1 }, { a: 2 });
  agree(null, "notDeepEqual", { a: 1 }, { a: 1 });
  agree(null, "deepStrictEqual", [1], [1]);
  agree(null, "notDeepStrictEqual", [1], [2]);
});

test("ok and the callable form", () => {
  agree(null, "ok", 1);
  agree(null, "ok", 0);
  agree(null, "ok", "");
  agree(null, "ok", "x");
  agree(null, "ok", null);

  nodeAssert.equal(outcome(() => ours(1)).threw, outcome(() => nodeAssert(1)).threw);
  nodeAssert.equal(outcome(() => ours(0)).threw, outcome(() => nodeAssert(0)).threw);
  nodeAssert.equal(outcome(() => ours(0)).code, "ERR_ASSERTION");
});

test("match and doesNotMatch", () => {
  agree(null, "match", "hello world", /world/);
  agree(null, "match", "hello", /world/);
  agree(null, "doesNotMatch", "hello", /world/);
  agree(null, "doesNotMatch", "hello world", /world/);
});

test("throws: RegExp, constructor, object and validation function", () => {
  const boom = () => { throw new TypeError("boom happened"); };
  const quiet = () => {};

  agree(null, "throws", boom);
  agree(null, "throws", quiet);
  agree(null, "throws", boom, /boom/);
  agree(null, "throws", boom, /nope/);
  agree(null, "throws", boom, TypeError);
  agree(null, "throws", boom, RangeError);
  agree(null, "throws", boom, { name: "TypeError", message: "boom happened" });
  agree(null, "throws", boom, { name: "RangeError" });
  agree(null, "throws", boom, (/** @type {unknown} */ error) => error instanceof TypeError);
  agree(null, "doesNotThrow", quiet);
  agree(null, "doesNotThrow", boom);
});

test("throws honours a matcher that is not a RegExp", () => {
  const boom = () => { throw new TypeError("boom"); };
  nodeAssert.equal(outcome(() => ours.throws(boom, RangeError)).threw, true, "wrong constructor must fail");
  nodeAssert.equal(outcome(() => ours.throws(boom, () => false)).threw, true, "failing validator must fail");
  nodeAssert.equal(outcome(() => ours.throws(boom, TypeError)).threw, false);
});

test("rejects and doesNotReject, thunk and promise forms", async () => {
  const failing = () => Promise.reject(new Error("nope"));
  const passing = () => Promise.resolve(1);

  nodeAssert.deepEqual(
    await asyncOutcome(() => ours.rejects(failing)),
    await asyncOutcome(() => nodeAssert.rejects(failing)),
  );
  nodeAssert.deepEqual(
    await asyncOutcome(() => ours.rejects(passing)),
    await asyncOutcome(() => nodeAssert.rejects(passing)),
  );
  nodeAssert.equal((await asyncOutcome(() => ours.rejects(failing, /nope/))).threw, false);
  nodeAssert.equal((await asyncOutcome(() => ours.rejects(failing, /other/))).threw, true);
  nodeAssert.equal((await asyncOutcome(() => ours.rejects(Promise.reject(new Error("x"))))).threw, false);
  nodeAssert.equal((await asyncOutcome(() => ours.doesNotReject(passing))).threw, false);
  nodeAssert.equal((await asyncOutcome(() => ours.doesNotReject(failing))).threw, true);
});

test("fail and ifError", () => {
  const mine = outcome(() => ours.fail("gave up"));
  const theirs = outcome(() => nodeAssert.fail("gave up"));
  nodeAssert.equal(mine.threw, true);
  nodeAssert.equal(mine.message, theirs.message);
  nodeAssert.equal(mine.code, theirs.code);

  agree(null, "ifError", null);
  agree(null, "ifError", undefined);
  nodeAssert.equal(outcome(() => ours.ifError(new Error("x"))).threw, true);
});

test("a custom message replaces the generated one", () => {
  const error = outcome(() => ours.equal(1, 2, "counts must match"));
  nodeAssert.equal(error.message, "counts must match");
  nodeAssert.equal(error.generatedMessage, false);
  nodeAssert.equal(String(outcome(() => ours.equal(1, 2)).message).includes("strictly equal"), true);
});

test("AssertionError carries actual, expected, operator and a real stack", () => {
  const error = outcome(() => ours.equal({ count: 2 }, { count: 3 }));
  nodeAssert.equal(error.name, "AssertionError");
  nodeAssert.equal(error.code, "ERR_ASSERTION");
  nodeAssert.equal(error.operator, "strictEqual");
  nodeAssert.deepEqual(error.actual, { count: 2 });
  nodeAssert.deepEqual(error.expected, { count: 3 });

  try {
    ours.equal(1, 2);
  } catch (thrown) {
    const stack = thrown instanceof Error ? thrown.stack : undefined;
    nodeAssert.equal(typeof stack, "string");
    nodeAssert.equal(String(stack).includes("assert.test.js"), true, "the caller's frame must be in the stack");
    nodeAssert.equal(String(stack).split("\n").length > 1, true, "the stack must not be emptied");
  }
});

test("the diff shows what differs", () => {
  const error = outcome(() => ours.deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 }));
  nodeAssert.equal(String(error.message).includes("+"), true);
  nodeAssert.equal(String(error.message).includes("-"), true);
  nodeAssert.equal(String(error.message).includes("b: 2"), true);
  nodeAssert.equal(String(error.message).includes("b: 3"), true);
});

test("partialDeepStrictEqual agrees with node", () => {
  agree(null, "partialDeepStrictEqual", { a: 1, b: 2 }, { a: 1 });
  agree(null, "partialDeepStrictEqual", { a: 1 }, { a: 1, b: 2 });
  agree(null, "partialDeepStrictEqual", { a: { x: 1, y: 2 } }, { a: { x: 1 } });
  agree(null, "partialDeepStrictEqual", { a: 1 }, { a: "1" });
  agree(null, "partialDeepStrictEqual", [1, 2, 3], [1, 2]);
  agree(null, "partialDeepStrictEqual", [1, 2, 3], [3]);
  agree(null, "partialDeepStrictEqual", [1, 2], [4]);
  agree(null, "partialDeepStrictEqual", { list: [1, 2, 3], extra: true }, { list: [2] });
  agree(null, "partialDeepStrictEqual", { a: 1 }, {});
});

test("the whole node:assert surface is present, by name", () => {
  for (const name of [
    "ok", "equal", "notEqual", "deepEqual", "notDeepEqual", "strictEqual", "notStrictEqual",
    "deepStrictEqual", "notDeepStrictEqual", "partialDeepStrictEqual", "match", "doesNotMatch",
    "throws", "doesNotThrow", "rejects", "doesNotReject", "ifError", "fail", "AssertionError", "Assert",
  ])
    nodeAssert.equal(typeof Reflect.get(ours, name) !== "undefined", true, `assert.${name} is missing from the shim`);
});

test("the loose surface stays loose, and .strict reaches the strict one", () => {
  nodeAssert.equal(outcome(() => oursLoose.equal(1, "1")).threw, outcome(() => nodeLoose.equal(1, "1")).threw);
  nodeAssert.equal(outcome(() => oursLoose.equal(1, "1")).threw, false);
  nodeAssert.equal(outcome(() => oursLoose.strict.equal(1, "1")).threw, true);
  nodeAssert.equal(oursLoose.strict.strict, oursLoose.strict);
  nodeAssert.equal(outcome(() => oursLoose.deepEqual({ a: 1 }, { a: "1" })).threw, false);
  nodeAssert.equal(outcome(() => ours.deepEqual({ a: 1 }, { a: "1" })).threw, true);
});
