/**
 * The `node:assert/strict` shim: node's strict view, where `equal` is
 * `strictEqual` and `deepEqual` is `deepStrictEqual`. This is the specifier the
 * whole repo imports.
 */
import { strict } from "./node-assert.js";

export const {
  ok, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual,
  deepStrictEqual, notDeepStrictEqual, partialDeepStrictEqual, match, doesNotMatch,
  throws, doesNotThrow, rejects, doesNotReject, ifError, fail, AssertionError, Assert,
} = strict;

export { strict };
export default strict;
