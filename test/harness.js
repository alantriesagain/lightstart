/**
 * The browser test runner: a `node:test`-shaped registry and execution engine.
 *
 * Registration is synchronous and eager; execution is a separate async tree
 * walk. That split is what buys correct semantics; the whole tree, including
 * every `.only`, is known before anything runs.
 *
 * Order guarantees, matching node:
 *   before (own level, serial)
 *     → children in registration order, batched by `concurrency` (default 1)
 *       → beforeEach root→leaf
 *         → the test body, raced against `timeout`
 *       → afterEach leaf→root, in its OWN try, so cleanup runs even when the
 *         body threw
 *   → after (own level), always, even when a hook above failed
 */
import { MockTracker } from "./mock.js";

/** @import { Hook, LooseFn, RunCounts, RunOutcome, SuiteContext, SuiteFn, SuiteNode, TestContext, TestFn, TestNode, TestOptions, TestResult } from "./types.ts" */

/** @param {string} member @param {string} reason @param {string} remedy @returns {never} */
const NOT_SUPPORTED = (member, reason, remedy) => {
  throw new Error(`${member} is not available in the browser test runner (${reason}). ${remedy}`);
};

/**
 * @param {string} name
 * @param {TestNode | null} parent
 * @param {TestOptions} [options]
 * @returns {SuiteNode}
 */
const makeSuite = (name, parent, options = {}) => ({
  kind: "suite",
  name,
  parent,
  options,
  children: [],
  hooks: { before: [], after: [], beforeEach: [], afterEach: [] },
  registrationError: null,
});

/**
 * Errors nothing caught, collected for whichever test was running when they
 * arrived. A listener invoked by `dispatchEvent` runs on the dispatch stack, so
 * a throw there is reported globally while `dispatchEvent` returns normally and
 * the test body resolves; without this the test passes green over dead code.
 * @type {string[]}
 */
let uncaught = [];

const BENIGN = /^ResizeObserver loop/;

/** @param {Event} event @returns {string} */
const describeUncaught = (event) => {
  const { error, message } = /** @type {ErrorEvent} */ (event);
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(message || error || event.type);
};

/**
 * Record what a target reports as uncaught. Exported for the harness's own
 * tests, which have no window to raise a real one.
 * @param {EventTarget} target
 * @returns {() => void} detach
 */
export const _watchUncaught = (target) => {
  /** @param {Event} event */
  const onError = (event) => {
    const described = describeUncaught(event);
    if (!BENIGN.test(described)) uncaught.push(described);
  };
  /** @param {Event} event */
  const onRejection = (event) => {
    const { reason } = /** @type {PromiseRejectionEvent} */ (event);
    uncaught.push(`unhandled rejection: ${reason?.message ?? String(reason)}`);
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
};

/** @type {(() => void) | null} */
let detachGlobals = null;

const watchGlobals = () => {
  if (detachGlobals || typeof globalThis.addEventListener !== "function") return;
  detachGlobals = _watchUncaught(globalThis);
};

watchGlobals();

let root = makeSuite("", null);
/** @type {SuiteNode} */
let cursor = root;
let onlySeen = false;

/** Clears every registration. The runner page calls this between files. */
export const reset = () => {
  root = makeSuite("", null);
  cursor = root;
  onlySeen = false;
  uncaught = [];
};

export const _state = () => ({ root, cursor });

/**
 * @param {unknown} nameOrFn @param {unknown} optionsOrFn @param {unknown} maybeFn
 * @returns {{ name: string, fn: TestFn | undefined, options: TestOptions }}
 */
const normalizeArgs = (nameOrFn, optionsOrFn, maybeFn) => {
  const name = typeof nameOrFn === "function" ? (nameOrFn.name || "<anonymous>") : String(nameOrFn ?? "<anonymous>");
  const fn = /** @type {TestFn | undefined} */ (typeof nameOrFn === "function" ? nameOrFn
    : typeof optionsOrFn === "function" ? optionsOrFn
      : typeof maybeFn === "function" ? maybeFn : undefined);
  const options = /** @type {TestOptions} */ (optionsOrFn && typeof optionsOrFn === "object" ? optionsOrFn : {});
  return { name, fn, options };
};

/** @param {unknown} value @returns {value is PromiseLike<unknown>} */
const isThenable = (value) =>
  (typeof value === "object" || typeof value === "function")
  && value !== null
  && "then" in value
  && typeof value.then === "function";

/**
 * A thrown value the report can carry: an Error passes through, anything else
 * is wrapped with the original on `cause`. The wrapper carries no stack, so a
 * report never points at this file for a throw that happened elsewhere.
 * @param {unknown} failure @returns {Error}
 */
const asError = (failure) => {
  if (failure instanceof Error) return failure;
  const wrapper = new Error(String(failure), { cause: failure });
  wrapper.stack = "";
  return wrapper;
};

/**
 * A describe body must be synchronous: without AsyncLocalStorage the browser
 * cannot attribute a registration made after an await to the right parent, and
 * a partial implementation would mis-parent silently.
 * @param {unknown} nameOrFn @param {unknown} [optionsOrFn] @param {unknown} [maybeFn]
 */
export const registerSuite = (nameOrFn, optionsOrFn, maybeFn) => {
  const { name, fn, options } = normalizeArgs(nameOrFn, optionsOrFn, maybeFn);
  if (options.timeout !== undefined)
    NOT_SUPPORTED("describe({ timeout })", "a suite timeout is not enforced by the browser test runner", "Put the timeout on the tests that need one.");
  const suite = makeSuite(name, cursor, options);
  cursor.children.push(suite);
  if (options.only) onlySeen = true;
  if (!fn) return;

  const body = /** @type {SuiteFn} */ (fn);
  const previous = cursor;
  cursor = suite;
  try {
    const returned = body.call(undefined, makeSuiteContext(suite));
    if (isThenable(returned) && !(REGISTRATION in returned))
      throw new Error(`describe("${name}") returned a promise; async describe callbacks are not supported by the browser test runner. Move async setup into before().`);
  } catch (error) {
    suite.registrationError = error instanceof Error ? error : new Error(String(error));
  } finally {
    cursor = previous;
  }
};

const REGISTRATION = Symbol("light.test.registration");

/**
 * @param {unknown} nameOrFn @param {unknown} [optionsOrFn] @param {unknown} [maybeFn]
 * @returns {Promise<void>}
 */
export const registerTest = (nameOrFn, optionsOrFn, maybeFn) => {
  const { name, fn, options } = normalizeArgs(nameOrFn, optionsOrFn, maybeFn);
  /** @type {TestNode} */
  const test = { kind: "test", name, parent: cursor, options, fn, children: [] };
  cursor.children.push(test);
  if (options.only) onlySeen = true;
  return Object.assign(Promise.resolve(), { [REGISTRATION]: true });
};

/**
 * @param {"before"|"after"|"beforeEach"|"afterEach"} kind
 * @param {Hook["fn"]} fn
 * @param {Hook["options"]} [options]
 */
export const registerHook = (kind, fn, options = {}) => {
  refuseHookTimeout(kind, options);
  cursor.hooks[kind].push({ fn, options });
};

/**
 * A hook's `timeout` is accepted by node and ignored here, which would let a
 * hanging hook pass in the browser; so it is refused instead of dropped.
 * @param {string} member @param {Hook["options"] | undefined} options
 */
const refuseHookTimeout = (member, options) => {
  if (options?.timeout !== undefined)
    NOT_SUPPORTED(`${member}({ timeout })`, "hook timeouts are not enforced by the browser test runner", "Drop the option, or put the deadline in the hook itself.");
};

/**
 * @param {TestNode} node
 * @param {"beforeEach"|"afterEach"} kind
 * @returns {Hook[]}
 */
const chainOf = (node, kind) => {
  /** @type {Hook[]} */
  const chain = [];
  for (let current = node.parent; current; current = current.parent)
    if (current.hooks) chain.unshift(...current.hooks[kind]);
  return chain;
};

/** @param {Promise<unknown>} promise @returns {Promise<unknown>} */
const settle = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error === SKIP_SIGNAL ? error : asError(error);
  }
};

/**
 * @param {Promise<unknown>} promise
 * @param {number | undefined} ms
 * @param {AbortController} controller
 * @returns {Promise<unknown>}
 */
const withTimeout = (promise, ms, controller) => {
  if (!ms) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort(new Error(`test timed out after ${ms}ms`));
      reject(new Error(`test timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
};

/** @param {SuiteNode} suite @returns {SuiteContext} */
const makeSuiteContext = (suite) => ({
  name: suite.name,
  get signal() { return suite.controller?.signal; },
});

/**
 * @param {TestNode} test
 * @param {TestResult} result
 * @param {AbortController} controller
 * @returns {TestContext}
 */
const makeTestContext = (test, result, controller) => {
  const mock = new MockTracker();

  const context = {
    name: test.name,
    fullName: fullNameOf(test).join(" > "),
    signal: controller.signal,
    mock,
    /** @param {string} message */
    diagnostic(message) { result.diagnostics.push(String(message)); },
    /** @param {string} [message] */
    skip(message) { result.status = "skip"; result.reason = message; throw SKIP_SIGNAL; },
    /** @param {string} [message] */
    todo(message) { result.status = "todo"; result.reason = message; },
    /** @param {number} count */
    plan(count) { result.plan = count; },
    runOnly() {},
    /** @param {Hook["fn"]} fn @param {Hook["options"]} [options] */
    before(fn, options) { refuseHookTimeout("t.before", options); (test.beforeHooks ??= []).push({ fn, options }); },
    /** @param {Hook["fn"]} fn @param {Hook["options"]} [options] */
    after(fn, options) { refuseHookTimeout("t.after", options); (test.afterHooks ??= []).push({ fn, options }); },
    beforeEach() { return NOT_SUPPORTED("t.beforeEach", "a test has no children to bracket unless they are subtests", "Use before/beforeEach on the enclosing describe."); },
    afterEach() { return NOT_SUPPORTED("t.afterEach", "a test has no children to bracket unless they are subtests", "Use after/afterEach on the enclosing describe."); },
    /** @param {unknown} nameOrFn @param {unknown} [optionsOrFn] @param {unknown} [maybeFn] */
    test: (nameOrFn, optionsOrFn, maybeFn) => runSubtest(test, result, nameOrFn, optionsOrFn, maybeFn),
    get assert() { return countingAssert(result); },
  };
  return context;
};

const SKIP_SIGNAL = Symbol("skip");

/** @type {object | null} */
let assertModule = null;

/** @param {TestResult} result @returns {Record<string, LooseFn>} */
const countingAssert = (result) => {
  if (!assertModule) return NOT_SUPPORTED("t.assert", "the assert module was not attached", "Call attachAssert() from the node:test shim.");
  /** @type {Record<string, LooseFn>} */
  const bound = {};
  for (const [key, value] of Object.entries(assertModule))
    bound[key] = typeof value === "function"
      ? (...args) => { result.assertions += 1; return value(...args); }
      : value;
  bound.snapshot = () => NOT_SUPPORTED(
    "t.assert.snapshot",
    "snapshots need a filesystem to read and write .snapshot files",
    "Assert on the value directly.",
  );
  return bound;
};

/**
 * Called once by the node:test shim so `t.assert.*` exists without a cycle.
 * @param {object} assert
 */
export const attachAssert = (assert) => { assertModule = assert; };

/** @param {TestNode} node @returns {string[]} */
const fullNameOf = (node) => {
  /** @type {string[]} */
  const parts = [];
  for (let current = node; current && current.parent; current = current.parent) parts.unshift(current.name);
  return parts;
};

/**
 * @param {TestNode} parentTest @param {TestResult} parentResult
 * @param {unknown} nameOrFn @param {unknown} [optionsOrFn] @param {unknown} [maybeFn]
 * @returns {Promise<TestResult>}
 */
const runSubtest = async (parentTest, parentResult, nameOrFn, optionsOrFn, maybeFn) => {
  const { name, fn, options } = normalizeArgs(nameOrFn, optionsOrFn, maybeFn);
  /** @type {TestNode} */
  const child = { kind: "test", name, parent: parentTest, options, fn, children: [] };
  if (parentTest.beforeHooks?.length && !parentTest.beforeRan) {
    parentTest.beforeRan = true;
    const error = await runHooks(parentTest.beforeHooks, { name: parentTest.name, signal: parentTest.controller?.signal });
    if (error) {
      const result = emptyResult(child);
      result.status = "fail";
      result.error = asError(error);
      parentResult.subtests.push(result);
      parentResult.childFailed = true;
      return result;
    }
  }
  const result = await runTest(child, [], []);
  parentResult.subtests.push(result);
  if (result.status === "fail") parentResult.childFailed = true;
  return result;
};

/**
 * @param {TestNode} node
 * @returns {TestResult}
 */
const emptyResult = (node) => ({
  name: fullNameOf(node),
  status: "pass",
  durationMs: 0,
  error: null,
  reason: undefined,
  diagnostics: [],
  subtests: [],
  assertions: 0,
  plan: null,
  childFailed: false,
});

/** @param {Hook[]} hooks @param {SuiteContext | TestContext} arg @returns {Promise<unknown>} */
const runHooks = async (hooks, arg) => {
  for (const hook of hooks) {
    const error = await settle(Promise.resolve().then(() => hook.fn(arg)));
    if (error) return error;
  }
  return null;
};

/**
 * @param {TestNode} test @param {Hook[]} beforeEachChain @param {Hook[]} afterEachChain
 * @returns {Promise<TestResult>}
 */
const runTest = async (test, beforeEachChain, afterEachChain) => {
  const result = emptyResult(test);
  const started = Date.now();
  if (typeof test.options.plan === "number") result.plan = test.options.plan;

  if (test.options.skip) {
    result.status = "skip";
    result.reason = typeof test.options.skip === "string" ? test.options.skip : undefined;
    return result;
  }
  if (test.options.todo) {
    result.status = "todo";
    result.reason = typeof test.options.todo === "string" ? test.options.todo : undefined;
    return result;
  }
  const body = test.fn;
  if (!body) return result;

  uncaught = [];
  const controller = new AbortController();
  test.controller = controller;
  const context = makeTestContext(test, result, controller);

  const beforeError = await runHooks(beforeEachChain, context);
  let bodyError = beforeError;

  if (!bodyError) {
    bodyError = await settle(withTimeout(
      Promise.resolve().then(() => body(context)),
      test.options.timeout,
      controller,
    ));
    if (bodyError === SKIP_SIGNAL) bodyError = null;
  }

  const afterHookError = await runHooks([...(test.afterHooks ?? [])], context);
  const afterEachError = await runHooks(afterEachChain, context);

  context.mock.restoreAll();
  result.durationMs = Date.now() - started;

  if (result.status === "skip") return result;

  const raised = uncaught.length
    ? new Error(`nothing caught ${uncaught.length === 1 ? "an error" : `${uncaught.length} errors`} during this test: ${uncaught.join("; ")}`)
    : null;
  if (raised) raised.stack = "";
  const failure = bodyError || afterHookError || afterEachError || raised;
  if (failure) {
    result.status = "fail";
    result.error = asError(failure);
    if (afterEachError && failure !== afterEachError && result.error) result.error.cause ??= afterEachError;
    return result;
  }
  if (result.childFailed) {
    result.status = "fail";
    result.error = new Error("a subtest failed");
    return result;
  }
  if (result.plan !== null && result.plan !== result.assertions) {
    result.status = "fail";
    result.error = new Error(`plan expected ${result.plan} assertions, ${result.assertions} ran`);
    return result;
  }
  if (result.status !== "todo") result.status = "pass";
  return result;
};

/** @param {SuiteNode} suite @returns {TestNode[]} */
const selectChildren = (suite) => {
  const children = suite.children;
  if (!onlySeen) return children;
  const marked = children.filter((child) => child.options.only);
  return marked.length ? marked : children;
};

/**
 * @template T @template R
 * @param {T[]} items @param {number | boolean | undefined} size @param {(item: T) => Promise<R>} task
 * @returns {Promise<R[]>}
 */
const inBatches = async (items, size, task) => {
  if (!size || size === 1) {
    /** @type {R[]} */
    const out = [];
    for (const item of items) out.push(await task(item));
    return out;
  }
  const limit = size === true ? items.length : size;
  /** @type {R[]} */
  const out = [];
  for (let i = 0; i < items.length; i += limit)
    out.push(...await Promise.all(items.slice(i, i + limit).map(task)));
  return out;
};

/** @param {TestNode} node @param {Error} error @returns {TestResult[]} */
const failedSubtree = (node, error) => {
  if (node.kind === "test") {
    const result = emptyResult(node);
    result.status = "fail";
    result.error = error;
    return [result];
  }
  return node.children.flatMap((child) => failedSubtree(child, error));
};

/** @param {SuiteNode} suite @param {TestResult[]} results @returns {Promise<void>} */
const runSuite = async (suite, results) => {
  if (suite.registrationError) {
    results.push(...failedSubtree(suite, suite.registrationError));
    return;
  }
  if (suite.options.skip || suite.options.todo) {
    const result = emptyResult(suite);
    result.isSuite = true;
    result.status = suite.options.todo ? "todo" : "skip";
    result.reason = typeof (suite.options.skip ?? suite.options.todo) === "string"
      ? /** @type {string} */ (suite.options.skip ?? suite.options.todo)
      : undefined;
    results.push(result);
    return;
  }

  suite.controller = new AbortController();
  const beforeError = await runHooks(suite.hooks.before, makeSuiteContext(suite));
  if (beforeError) {
    const error = asError(beforeError);
    for (const child of selectChildren(suite)) results.push(...failedSubtree(child, error));
    await runHooks(suite.hooks.after, makeSuiteContext(suite));
    return;
  }

  const children = selectChildren(suite);
  const beforeEachChain = [...chainOf(suite, "beforeEach"), ...suite.hooks.beforeEach];
  const afterEachChain = [...suite.hooks.afterEach, ...chainOf(suite, "afterEach").reverse()];

  const produced = await inBatches(children, suite.options.concurrency, async (child) => {
    if (child.kind === "test") return [await runTest(child, beforeEachChain, afterEachChain)];
    /** @type {TestResult[]} */
    const nested = [];
    await runSuite(/** @type {SuiteNode} */ (child), nested);
    return nested;
  });
  for (const batch of produced) results.push(...batch);

  await runHooks(suite.hooks.after, makeSuiteContext(suite));
};

/**
 * Execute everything registered so far.
 * @param {{ namePattern?: RegExp }} [options]
 * @returns {Promise<RunOutcome>}
 */
export const run = async ({ namePattern } = {}) => {
  const started = Date.now();
  /** @type {TestResult[]} */
  const results = [];
  await runSuite(root, results);

  const selected = namePattern ? results.filter((r) => namePattern.test(r.name.join(" > "))) : results;
  /** @type {RunCounts} */
  const counts = { pass: 0, fail: 0, skip: 0, todo: 0, total: selected.length, suites: countSuites(root) };
  for (const result of selected) counts[result.status] += 1;
  return { results: selected, counts, durationMs: Date.now() - started };
};

/** @param {TestNode} suite @returns {number} */
const countSuites = (suite) =>
  suite.children.reduce((total, child) => child.kind === "suite" ? total + 1 + countSuites(child) : total, 0);
