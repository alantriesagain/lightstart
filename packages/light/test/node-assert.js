/**
 * The `node:assert` shim for the browser runner. Both the loose and the strict
 * surface are implemented rather than aliased: aliasing would make
 * `assert.equal(1, "1")` pass in node and fail in the browser, which is exactly
 * the silent divergence this runner exists to remove.
 *
 * The strict view is `assert.strict`, and `node:assert/strict` re-exports it.
 */
import { AssertionError } from "./assertion-error.js";
import { isDeepEqual, isDeepStrictEqual, isPartialDeepStrictEqual } from "./deep-equal.js";
import { diffLines, inspect } from "./inspect.js";

/** @import { ErrorFunction, ErrorMatcher } from "./types.ts" */

/**
 * @param {{ actual?: unknown, expected?: unknown, operator?: string, message?: string, stackStartFn?: Function, detail?: string }} options
 * @returns {never}
 */
const fail = ({ actual, expected, operator, message, stackStartFn, detail }) => {
  throw new AssertionError({
    message: message ?? detail,
    actual,
    expected,
    operator,
    stackStartFn,
    generatedMessage: message === undefined,
  });
};

/** @param {unknown} value @returns {string | undefined} */
const messageOf = (value) => {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) return String(value.message);
  return undefined;
};

/** @param {unknown} actual @param {unknown} expected @param {string} headline @returns {string} */
const comparison = (actual, expected, headline) =>
  `${headline}\n\n${diffLines(actual, expected).join("\n")}\n`;

/** @param {boolean} strict */
const build = (strict) => {
  const deep = strict ? isDeepStrictEqual : isDeepEqual;
  // eslint-disable-next-line eqeqeq -- the loose surface IS `==`; that is what distinguishes it from strict
  const same = strict ? Object.is : (/** @type {unknown} */ a, /** @type {unknown} */ b) => a == b;
  const label = strict ? "strict" : "loose";

  /** @param {unknown} value @param {string} [message] */
  function ok(value, message) {
    if (value) return;
    fail({
      actual: value, expected: true, operator: "==", message, stackStartFn: ok,
      detail: `The expression evaluated to a falsy value: ${inspect(value)}`,
    });
  }

  const callable = /** @param {unknown} value @param {string} [message] */ function assert(value, message) { ok(value, message); };

  const api = {
    ok,
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    equal(actual, expected, message) {
      if (same(actual, expected)) return;
      fail({
        actual, expected, operator: strict ? "strictEqual" : "==", message, stackStartFn: api.equal,
        detail: comparison(actual, expected, `Expected values to be ${label}ly equal:`),
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    notEqual(actual, expected, message) {
      if (!same(actual, expected)) return;
      fail({
        actual, expected, operator: strict ? "notStrictEqual" : "!=", message, stackStartFn: api.notEqual,
        detail: `Expected "actual" to be ${label}ly unequal to:\n\n${inspect(expected)}\n`,
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    deepEqual(actual, expected, message) {
      if (deep(actual, expected)) return;
      fail({
        actual, expected, operator: strict ? "deepStrictEqual" : "deepEqual", message, stackStartFn: api.deepEqual,
        detail: comparison(actual, expected, `Expected values to be ${strict ? "strictly deep-equal" : "loosely deep-equal"}:`),
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    notDeepEqual(actual, expected, message) {
      if (!deep(actual, expected)) return;
      fail({
        actual, expected, operator: strict ? "notDeepStrictEqual" : "notDeepEqual", message, stackStartFn: api.notDeepEqual,
        detail: `Expected "actual" not to be ${strict ? "strictly deep-equal" : "loosely deep-equal"} to:\n\n${inspect(expected)}\n`,
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    strictEqual(actual, expected, message) {
      if (Object.is(actual, expected)) return;
      fail({
        actual, expected, operator: "strictEqual", message, stackStartFn: api.strictEqual,
        detail: comparison(actual, expected, "Expected values to be strictly equal:"),
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    notStrictEqual(actual, expected, message) {
      if (!Object.is(actual, expected)) return;
      fail({
        actual, expected, operator: "notStrictEqual", message, stackStartFn: api.notStrictEqual,
        detail: `Expected "actual" to be strictly unequal to:\n\n${inspect(expected)}\n`,
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    deepStrictEqual(actual, expected, message) {
      if (isDeepStrictEqual(actual, expected)) return;
      fail({
        actual, expected, operator: "deepStrictEqual", message, stackStartFn: api.deepStrictEqual,
        detail: comparison(actual, expected, "Expected values to be strictly deep-equal:"),
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    notDeepStrictEqual(actual, expected, message) {
      if (!isDeepStrictEqual(actual, expected)) return;
      fail({
        actual, expected, operator: "notDeepStrictEqual", message, stackStartFn: api.notDeepStrictEqual,
        detail: `Expected "actual" not to be strictly deep-equal to:\n\n${inspect(expected)}\n`,
      });
    },
    /** @param {unknown} actual @param {unknown} expected @param {string} [message] */
    partialDeepStrictEqual(actual, expected, message) {
      if (isPartialDeepStrictEqual(actual, expected)) return;
      fail({
        actual, expected, operator: "partialDeepStrictEqual", message, stackStartFn: api.partialDeepStrictEqual,
        detail: comparison(actual, expected, "Expected key-value pairs in the second argument to be present in the first:"),
      });
    },
    /** @param {string} string @param {RegExp} regexp @param {string} [message] */
    match(string, regexp, message) {
      if (regexp.test(string)) return;
      fail({
        actual: string, expected: regexp, operator: "match", message, stackStartFn: api.match,
        detail: `The input did not match the regular expression ${regexp}. Input:\n\n${inspect(string)}\n`,
      });
    },
    /** @param {string} string @param {RegExp} regexp @param {string} [message] */
    doesNotMatch(string, regexp, message) {
      if (!regexp.test(string)) return;
      fail({
        actual: string, expected: regexp, operator: "doesNotMatch", message, stackStartFn: api.doesNotMatch,
        detail: `The input was expected to not match the regular expression ${regexp}. Input:\n\n${inspect(string)}\n`,
      });
    },
    /** @param {() => unknown} fn @param {ErrorMatcher} [expected] @param {string} [message] */
    throws(fn, expected, message) {
      /** @type {unknown} */
      let thrown;
      let didThrow = false;
      try { fn(); } catch (error) { thrown = error; didThrow = true; }
      if (!didThrow)
        fail({
          actual: undefined, expected, operator: "throws", message, stackStartFn: api.throws,
          detail: "Missing expected exception.",
        });
      checkError(thrown, expected, message, api.throws);
    },
    /** @param {() => unknown} fn @param {string} [message] */
    doesNotThrow(fn, message) {
      try { fn(); } catch (error) {
        fail({
          actual: error, expected: undefined, operator: "doesNotThrow", message, stackStartFn: api.doesNotThrow,
          detail: `Got unwanted exception.\nActual message: "${messageOf(error)}"`,
        });
      }
    },
    /** @param {Promise<unknown> | (() => Promise<unknown>)} promiseOrFn @param {ErrorMatcher} [expected] @param {string} [message] */
    async rejects(promiseOrFn, expected, message) {
      const promise = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
      /** @type {unknown} */
      let thrown;
      let didReject = false;
      try { await promise; } catch (error) { thrown = error; didReject = true; }
      if (!didReject)
        fail({
          actual: undefined, expected, operator: "rejects", message, stackStartFn: api.rejects,
          detail: "Missing expected rejection.",
        });
      checkError(thrown, expected, message, api.rejects);
    },
    /** @param {Promise<unknown> | (() => Promise<unknown>)} promiseOrFn @param {string} [message] */
    async doesNotReject(promiseOrFn, message) {
      const promise = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
      try { await promise; } catch (error) {
        fail({
          actual: error, expected: undefined, operator: "doesNotReject", message, stackStartFn: api.doesNotReject,
          detail: `Got unwanted rejection.\nActual message: "${messageOf(error)}"`,
        });
      }
    },
    /** @param {unknown} value */
    ifError(value) {
      if (value === null || value === undefined) return;
      fail({
        actual: value, expected: null, operator: "ifError", stackStartFn: api.ifError,
        detail: `ifError got unwanted exception: ${messageOf(value) ?? inspect(value)}`,
      });
    },
    /** @param {string | Error} [message] */
    fail(message) {
      if (message instanceof Error) throw message;
      fail({
        actual: undefined, expected: undefined, operator: "fail", stackStartFn: api.fail,
        detail: message ?? "Failed",
        message: typeof message === "string" ? message : undefined,
      });
    },
    AssertionError,
  };

  /** @param {unknown} error @param {ErrorMatcher | undefined} expected @param {string | undefined} message @param {Function} stackStartFn */
  const checkError = (error, expected, message, stackStartFn) => {
    if (expected === undefined || typeof expected === "string") return;
    /** @param {string} detail */
    const reject = (detail) => fail({
      actual: error, expected, operator: stackStartFn.name, message, stackStartFn, detail,
    });

    if (expected instanceof RegExp) {
      const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      if (!expected.test(text)) reject(`The input did not match the regular expression ${expected}. Input:\n\n${inspect(text)}\n`);
      return;
    }
    if (typeof expected === "function") {
      const matcher = /** @type {ErrorFunction} */ (expected);
      if (matcher.prototype !== undefined && error instanceof matcher) return;
      if (matcher.prototype === undefined || !Object.getOwnPropertyNames(matcher.prototype).includes("constructor")) {
        if (matcher(error) === true) return;
        reject("The validation function is expected to return \"true\".");
        return;
      }
      reject(`The error is expected to be an instance of "${matcher.name}". Received ${inspect(error)}`);
      return;
    }
    if (typeof expected === "object") {
      const wanted = /** @type {Record<string, unknown>} */ (expected);
      const got = /** @type {Record<string, unknown> | null | undefined} */ (error);
      for (const key of Object.keys(wanted)) {
        const want = wanted[key];
        const value = got?.[key];
        const matches = want instanceof RegExp ? want.test(String(value)) : isDeepStrictEqual(value, want);
        if (!matches) reject(comparison(error, expected, "Comparison failed:"));
      }
    }
  };

  return Object.assign(callable, api);
};

function Assert() {
  return strictAssert;
}

const strictBase = build(true);
const strictAssert = Object.assign(strictBase, { Assert, strict: strictBase });
const looseAssert = Object.assign(build(false), { Assert, strict: strictAssert });

export const {
  ok, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual,
  deepStrictEqual, notDeepStrictEqual, partialDeepStrictEqual, match, doesNotMatch,
  throws, doesNotThrow, rejects, doesNotReject, ifError, fail: failAssertion,
} = looseAssert;
export { failAssertion as fail, Assert };

export { AssertionError };
export const strict = strictAssert;
export default looseAssert;
