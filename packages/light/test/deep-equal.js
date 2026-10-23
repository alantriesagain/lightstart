/**
 * Structural comparison matching `node:util`'s `isDeepStrictEqual` /
 * `isDeepEqual`. The engine this replaces compared `JSON.stringify` output,
 * which made key order significant and erased `undefined`, functions, symbols,
 * Map/Set contents, prototypes and the `NaN`/`-0` distinctions.
 *
 * `deep-equal.test.js` pins every rule here against the real `node:util`
 * implementation; that test is the specification, not this file.
 */

/** @import { Memo } from "./types.ts" */

/** @param {unknown} value @returns {string} */
const tagOf = (value) => Object.prototype.toString.call(value);

const BOXED = new Set(["[object Number]", "[object String]", "[object Boolean]", "[object Symbol]", "[object BigInt]"]);

/** @param {unknown} value @returns {boolean} */
const isPrimitive = (value) => value === null || (typeof value !== "object" && typeof value !== "function");

/** @param {object} value @returns {(string | symbol)[]} */
const ownKeys = (value) => [
  ...Object.keys(value),
  ...Object.getOwnPropertySymbols(value).filter((symbol) => Object.prototype.propertyIsEnumerable.call(value, symbol)),
];

/** @param {ArrayBufferView | ArrayBuffer} value @returns {Uint8Array} */
const bytesOf = (value) => ArrayBuffer.isView(value)
  ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  : new Uint8Array(value);

/** @param {ArrayBufferView | ArrayBuffer} a @param {ArrayBufferView | ArrayBuffer} b @returns {boolean} */
const bytesEqual = (a, b) => {
  const viewA = bytesOf(a);
  const viewB = bytesOf(b);
  if (viewA.byteLength !== viewB.byteLength) return false;
  for (let i = 0; i < viewA.byteLength; i++) if (viewA[i] !== viewB[i]) return false;
  return true;
};

/** @param {object} a @param {object} b @returns {boolean} */
const sameKind = (a, b) => {
  if (a.constructor === b.constructor) return true;
  const nameA = a.constructor?.name;
  const nameB = b.constructor?.name;
  return Boolean(nameA) && nameA === nameB;
};

/** @param {unknown} a @param {unknown} b @param {boolean} strict @param {Memo} memo @returns {boolean} */
const compare = (a, b, strict, memo) => {
  if (strict ? Object.is(a, b) : a === b) return true;

  if (isPrimitive(a) || isPrimitive(b)) {
    if (strict) {
      if (typeof a === "number" && typeof b === "number") return Object.is(a, b);
      return false;
    }
    // eslint-disable-next-line eqeqeq -- loose deepEqual IS `==`; that is the semantic being implemented
    if (isPrimitive(a) && isPrimitive(b)) return a == b;
    const primitive = isPrimitive(a) ? a : b;
    const boxed = /** @type {{ valueOf: () => unknown }} */ (isPrimitive(a) ? b : a);
    if (!BOXED.has(tagOf(boxed))) return false;
    // eslint-disable-next-line eqeqeq -- ditto: node unwraps a boxed primitive and compares loosely
    return boxed.valueOf() == primitive;
  }

  if (typeof a === "function" || typeof b === "function") return false;

  const tagA = tagOf(a);
  const tagB = tagOf(b);
  if (tagA !== tagB) return false;

  const objectA = /** @type {object} */ (a);
  const objectB = /** @type {object} */ (b);
  if (strict && !sameKind(objectA, objectB)) return false;

  let bucket = memo.get(objectA);
  if (bucket?.has(objectB)) return true;
  if (!bucket) {
    bucket = new Set();
    memo.set(objectA, bucket);
  }
  bucket.add(objectB);

  const result = compareContents(objectA, objectB, tagA, strict, memo);
  bucket.delete(objectB);
  return result;
};

/** @param {object} a @param {object} b @param {string} tag @param {boolean} strict @param {Memo} memo @returns {boolean} */
const compareContents = (a, b, tag, strict, memo) => {
  if (BOXED.has(tag)) {
    const primA = /** @type {{ valueOf: () => unknown }} */ (a).valueOf();
    const primB = /** @type {{ valueOf: () => unknown }} */ (b).valueOf();
    if (!(typeof primA === "number" ? Object.is(primA, primB) : primA === primB)) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  if (tag === "[object Date]") {
    const dateA = /** @type {Date} */ (a);
    const dateB = /** @type {Date} */ (b);
    if (!Object.is(dateA.getTime(), dateB.getTime())) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  if (tag === "[object RegExp]") {
    const regexpA = /** @type {RegExp} */ (a);
    const regexpB = /** @type {RegExp} */ (b);
    if (regexpA.source !== regexpB.source || regexpA.flags !== regexpB.flags) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  if (tag === "[object Error]" || a instanceof Error) {
    const errorA = /** @type {Error & { cause?: unknown }} */ (a);
    const errorB = /** @type {Error & { cause?: unknown }} */ (b);
    if (errorA.name !== errorB.name || errorA.message !== errorB.message) return false;
    if (("cause" in errorA) !== ("cause" in errorB)) return false;
    if ("cause" in errorA && !compare(errorA.cause, errorB.cause, strict, memo)) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  if (tag === "[object ArrayBuffer]" || tag === "[object SharedArrayBuffer]") {
    const bufferA = /** @type {ArrayBuffer} */ (a);
    const bufferB = /** @type {ArrayBuffer} */ (b);
    return bufferA.byteLength === bufferB.byteLength && bytesEqual(bufferA, bufferB);
  }

  if (ArrayBuffer.isView(a)) {
    const viewB = /** @type {ArrayBufferView} */ (b);
    if (a.constructor !== viewB.constructor) return false;
    if (a.byteLength !== viewB.byteLength) return false;
    if (!bytesEqual(a, viewB)) return false;
    return compareOwnProperties(a, b, strict, memo, true);
  }

  if (tag === "[object Map]") {
    const mapA = /** @type {Map<unknown, unknown>} */ (a);
    const mapB = /** @type {Map<unknown, unknown>} */ (b);
    if (mapA.size !== mapB.size) return false;
    if (!compareEntries(mapA, mapB, strict, memo)) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  if (tag === "[object Set]") {
    const setA = /** @type {Set<unknown>} */ (a);
    const setB = /** @type {Set<unknown>} */ (b);
    if (setA.size !== setB.size) return false;
    if (!compareMembers(setA, setB, strict, memo)) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  if (Array.isArray(a)) {
    const arrayB = /** @type {unknown[]} */ (b);
    if (a.length !== arrayB.length) return false;
    return compareOwnProperties(a, b, strict, memo);
  }

  return compareOwnProperties(a, b, strict, memo);
};

/**
 * @param {object} a @param {object} b @param {boolean} strict @param {Memo} memo
 * @param {boolean} [skipIndices]
 * @returns {boolean}
 */
const compareOwnProperties = (a, b, strict, memo, skipIndices = false) => {
  let keysA = ownKeys(a);
  let keysB = ownKeys(b);
  if (skipIndices) {
    /** @param {string | symbol} key */
    const notIndex = (key) => typeof key === "symbol" || !/^\d+$/.test(key);
    keysA = keysA.filter(notIndex);
    keysB = keysB.filter(notIndex);
  }
  if (keysA.length !== keysB.length) return false;
  const left = /** @type {Record<string | symbol, unknown>} */ (a);
  const right = /** @type {Record<string | symbol, unknown>} */ (b);
  for (const key of keysA) {
    if (!Object.prototype.propertyIsEnumerable.call(b, key) && !(key in b)) return false;
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!compare(left[key], right[key], strict, memo)) return false;
  }
  return true;
};

/**
 * @param {Map<unknown, unknown>} a @param {Map<unknown, unknown>} b
 * @param {boolean} strict @param {Memo} memo
 * @returns {boolean}
 */
const compareEntries = (a, b, strict, memo) => {
  /** @type {[unknown, unknown][]} */
  const pending = [];
  for (const [key, value] of a)
    if (isPrimitive(key)) {
      if (!b.has(key)) {
        pending.push([key, value]);
        continue;
      }
      if (!compare(value, b.get(key), strict, memo)) return false;
    } else pending.push([key, value]);

  if (pending.length === 0) return true;

  const candidates = [...b].filter(([key]) => !isPrimitive(key) || !a.has(key));
  return matchUnordered(pending, candidates, ([keyA, valueA], [keyB, valueB]) =>
    compare(keyA, keyB, strict, memo) && compare(valueA, valueB, strict, memo));
};

/**
 * @param {Set<unknown>} a @param {Set<unknown>} b @param {boolean} strict @param {Memo} memo
 * @returns {boolean}
 */
const compareMembers = (a, b, strict, memo) => {
  /** @type {unknown[]} */
  const pending = [];
  for (const member of a) {
    if (isPrimitive(member)) {
      if (!b.has(member)) pending.push(member);
      continue;
    }
    pending.push(member);
  }
  if (pending.length === 0) return true;

  const candidates = [...b].filter((member) => !isPrimitive(member) || !a.has(member));
  return matchUnordered(pending, candidates, (left, right) => compare(left, right, strict, memo));
};

/**
 * @template T
 * @param {T[]} left @param {T[]} right @param {(a: T, b: T) => boolean} matches
 * @returns {boolean}
 */
const matchUnordered = (left, right, matches) => {
  if (left.length !== right.length) return false;
  const taken = new Set();
  for (const item of left) {
    let found = false;
    for (let i = 0; i < right.length; i++) {
      if (taken.has(i)) continue;
      if (matches(item, right[i])) {
        taken.add(i);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
};

/**
 * Named for `node:util`'s export of the same name, and held to it by
 * `deep-equal.test.js`.
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export const isDeepStrictEqual = (a, b) => compare(a, b, true, new Map());

/**
 * `expected` describes a subset of `actual`: every own enumerable key must be
 * present and deep-strict-equal, and an array is satisfied by containment
 * rather than by position. Backs node's `assert.partialDeepStrictEqual`.
 * @param {unknown} actual @param {unknown} expected @returns {boolean}
 */
export const isPartialDeepStrictEqual = (actual, expected) => {
  if (isPrimitive(expected) || isPrimitive(actual)) return Object.is(actual, expected);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((wanted) => actual.some((candidate) => isPartialDeepStrictEqual(candidate, wanted)));
  }
  if (Array.isArray(actual)) return false;
  const left = /** @type {Record<string | symbol, unknown>} */ (actual);
  const right = /** @type {Record<string | symbol, unknown>} */ (expected);
  if (!sameKind(left, right)) return false;
  if (expected instanceof Map || expected instanceof Set || expected instanceof Date || expected instanceof RegExp)
    return isDeepStrictEqual(actual, expected);
  return ownKeys(right).every((key) =>
    Object.prototype.hasOwnProperty.call(left, key) && isPartialDeepStrictEqual(left[key], right[key]));
};

/**
 * The loose counterpart. NOTE the name is ours: `node:util` exports only
 * `isDeepStrictEqual` and keeps its loose comparison private. Nothing outside
 * this package imports it; it backs `assert.deepEqual` on the non-strict
 * surface.
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export const isDeepEqual = (a, b) => compare(a, b, false, new Map());
