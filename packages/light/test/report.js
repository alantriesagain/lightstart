/**
 * Turns a run's result tree into the JSON the runner page posts back. Errors
 * are flattened here: an `Error` does not survive `JSON.stringify`, and the
 * page is the only place that still has the real one.
 */
import { diffLines, inspect } from "./inspect.js";

/** @import { RunCounts, SerializedError, TestResult, WireResult, WireRun } from "./types.ts" */

const ORIGIN = /https?:\/\/[^/)\s]+/g;

/** @param {unknown} stack @returns {string[]} */
const cleanStack = (stack) =>
  String(stack ?? "")
    .split("\n")
    .slice(1)
    .map((line) => line.trim().replace(ORIGIN, ""))
    .filter((line) => line.startsWith("at "))
    .slice(0, 8);

/** @param {unknown} raw @returns {SerializedError | null} */
const serializeError = (raw) => {
  if (!raw) return null;
  if (!(raw instanceof Error)) return { name: "Error", message: String(raw), stack: [] };
  const error = /** @type {Error & { code?: string, operator?: string, actual?: unknown, expected?: unknown }} */ (raw);
  /** @type {SerializedError} */
  const serialized = {
    name: error.name,
    code: error.code,
    message: error.message,
    operator: error.operator,
    stack: cleanStack(error.stack),
  };
  if (error.operator) {
    serialized.actualText = inspect(error.actual);
    serialized.expectedText = inspect(error.expected);
    serialized.diff = diffLines(error.actual, error.expected);
  }
  if (error.cause) serialized.cause = serializeError(error.cause);
  return serialized;
};

/** @param {TestResult} result @returns {WireResult} */
const serializeResult = (result) => ({
  name: result.name,
  status: result.status,
  durationMs: result.durationMs,
  reason: result.reason,
  diagnostics: result.diagnostics,
  error: serializeError(result.error),
  subtests: result.subtests.map(serializeResult),
});

/**
 * @param {{ results: TestResult[], counts: RunCounts, durationMs: number }} run
 * @param {{ file?: string, shimLoaded?: boolean, loadError?: unknown }} [meta]
 * @returns {WireRun}
 */
export const toWireFormat = ({ results, counts, durationMs }, meta = {}) => ({
  shimLoaded: meta.shimLoaded ?? true,
  file: meta.file ?? null,
  loadError: meta.loadError ? serializeError(meta.loadError) : null,
  durationMs,
  counts,
  tests: results.map(serializeResult),
  failures: results.filter((result) => result.status === "fail").map(serializeResult),
});

/**
 * The shape reported when a file could not even be imported.
 * @param {string} file @param {unknown} error @param {{ shimLoaded?: boolean }} [options]
 * @returns {WireRun}
 */
export const loadFailure = (file, error, { shimLoaded = true } = {}) => ({
  shimLoaded,
  file,
  loadError: serializeError(error),
  durationMs: 0,
  counts: { pass: 0, fail: 1, skip: 0, todo: 0, total: 1, suites: 0 },
  tests: [],
  failures: [],
});
