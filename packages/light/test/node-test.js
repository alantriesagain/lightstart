/**
 * The `node:test` shim. In the browser this module is what the specifier
 * `node:test` resolves to, through the runner page's importmap; so a test file
 * is written exactly as it would be for `node --test`.
 *
 * Exact importmap keys only: a `node:` prefix key with a trailing slash does
 * not match and fails silently, so every specifier is registered by name in
 * `packages/test/cli/routes/test.ts`.
 */
import assertStrict from "./node-assert-strict.js";
import { attachAssert, registerHook, registerSuite, registerTest } from "./harness.js";
import { mock } from "./mock.js";

/** @import { Hook, TestOptions } from "./types.ts" */

attachAssert(assertStrict);

if (typeof globalThis !== "undefined") globalThis.__NODE_TEST_SHIM__ = true;

/** @param {string} member @param {string} reason @param {string} remedy @returns {() => never} */
const NOT_SUPPORTED = (member, reason, remedy) => () => {
  throw new Error(`${member} is not available in the browser test runner (${reason}). ${remedy}`);
};

/**
 * @template R
 * @param {(nameOrFn: unknown, optionsOrFn?: unknown, maybeFn?: unknown) => R} register
 */
const withModifiers = (register) => {
  /** @param {unknown} nameOrFn @param {unknown} [optionsOrFn] @param {unknown} [maybeFn] */
  const fn = (nameOrFn, optionsOrFn, maybeFn) => register(nameOrFn, optionsOrFn, maybeFn);
  /** @param {"skip" | "todo" | "only"} option */
  const withOption = (option) =>
    /** @param {unknown} nameOrFn @param {unknown} [optionsOrFn] @param {unknown} [maybeFn] */
    (nameOrFn, optionsOrFn, maybeFn) => {
      const options = /** @type {TestOptions} */ (optionsOrFn && typeof optionsOrFn === "object" ? optionsOrFn : {});
      const body = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
      return register(nameOrFn, { ...options, [option]: true }, body);
    };
  return Object.assign(fn, {
    skip: withOption("skip"),
    todo: withOption("todo"),
    only: withOption("only"),
  });
};

export const test = withModifiers(registerTest);
export const it = test;
export const describe = withModifiers(registerSuite);
export const suite = describe;

/** node exports these as standalone aliases of the modifiers; `t.skip === t.test.skip`. */
export const skip = test.skip;
export const only = test.only;
export const todo = test.todo;

/** @param {Hook["fn"]} fn @param {Hook["options"]} [options] */
export const before = (fn, options) => registerHook("before", fn, options);
/** @param {Hook["fn"]} fn @param {Hook["options"]} [options] */
export const after = (fn, options) => registerHook("after", fn, options);
/** @param {Hook["fn"]} fn @param {Hook["options"]} [options] */
export const beforeEach = (fn, options) => registerHook("beforeEach", fn, options);
/** @param {Hook["fn"]} fn @param {Hook["options"]} [options] */
export const afterEach = (fn, options) => registerHook("afterEach", fn, options);

export { mock };
export const assert = assertStrict;

export const run = NOT_SUPPORTED(
  "run()",
  "the programmatic runner spawns processes and globs the filesystem",
  "a runner page (light's `test/run.js`, or `bootstrapp test --browser`) runs the files in the browser.",
);

export const snapshot = {
  setResolveSnapshotPath: NOT_SUPPORTED(
    "snapshot.setResolveSnapshotPath",
    "snapshots need a filesystem",
    "Assert on the value directly.",
  ),
  setDefaultSnapshotSerializers: NOT_SUPPORTED(
    "snapshot.setDefaultSnapshotSerializers",
    "snapshots need a filesystem",
    "Assert on the value directly.",
  ),
};

export default test;
