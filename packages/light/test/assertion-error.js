/**
 * The browser runner's `AssertionError`, shaped like node's: it carries
 * `actual`/`expected`/`operator` so a reporter can render a diff, and it keeps
 * a REAL stack. The engine this replaces filtered stacks down to `.test.js`
 * frames, which deleted the message line and usually left nothing at all.
 */
export class AssertionError extends Error {
  /**
   * @param {{ message?: string, actual?: unknown, expected?: unknown, operator?: string, stackStartFn?: Function, generatedMessage?: boolean }} options
   */
  constructor({ message, actual, expected, operator, stackStartFn, generatedMessage = false }) {
    super(message);
    this.name = "AssertionError";
    this.code = "ERR_ASSERTION";
    this.actual = actual;
    this.expected = expected;
    this.operator = operator;
    this.generatedMessage = generatedMessage;
    if (stackStartFn && Error.captureStackTrace) Error.captureStackTrace(this, stackStartFn);
  }
}

export default AssertionError;
