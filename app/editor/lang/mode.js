/**
 * The tokenizer driver. A mode is written CM5-style (`token(stream, state)`
 * per token, or `line(text, state)` for a whole line); `defineMode` turns it
 * into a `Language` whose `tokenizeLine` never mutates the state it is given.
 * States are plain data: `cloneState` copies them, `equalState` compares them,
 * so a line cache can stop re-tokenizing where the state settles.
 */

/** @import { Language, ModeSpec, State, Token, TokenType } from "../types.js" */
import { createStream } from "./stream.js";

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export const cloneState = (value) => {
  if (Array.isArray(value)) return /** @type {T} */ (value.map(cloneState));
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneState(v);
    return /** @type {T} */ (out);
  }
  return value;
};

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export const equalState = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => equalState(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    const bo = /** @type {Record<string, unknown>} */ (b);
    const ao = /** @type {Record<string, unknown>} */ (a);
    return ka.every((k) => k in bo && equalState(ao[k], bo[k]));
  }
  return false;
};

/**
 * @param {Token[]} tokens
 * @param {Token} token
 */
export const pushToken = (tokens, token) => {
  if (token.to <= token.from) return;
  const last = tokens[tokens.length - 1];
  if (last && last.to === token.from && last.type === token.type && !last.mark && !token.mark) last.to = token.to;
  else tokens.push(token);
};

/**
 * Run a per-token mode over `[from, to)` of `text`, mutating `state`.
 * @param {ModeSpec} spec
 * @param {string} text
 * @param {number} from
 * @param {number} to
 * @param {State} state
 * @param {import("../types.js").Peek} peek
 * @param {Token[]} tokens
 */
export const runTokens = (spec, text, from, to, state, peek, tokens) => {
  if (!spec.token) throw new Error(`${spec.name} has no token()`);
  const stream = createStream(text, from, to);
  while (!stream.eol()) {
    stream.start = stream.pos;
    const result = spec.token(stream, state, peek);
    if (stream.pos === stream.start) throw new Error(`${spec.name} made no progress at ${stream.pos} in ${JSON.stringify(text)}`);
    if (result == null) continue;
    pushToken(tokens, typeof result === "string" ? { from: stream.start, to: stream.pos, type: result } : result);
  }
};

/**
 * @param {ModeSpec} spec
 * @returns {Language}
 */
export const defineMode = (spec) => ({
  name: spec.name,
  lookAhead: spec.lookAhead ?? 0,
  lineComment: spec.lineComment ?? null,
  startState: spec.startState,
  indentAfter: spec.indentAfter ?? (() => 0),
  tokenizeLine(text, state, peek = () => null) {
    const next = cloneState(state);
    if (spec.line) return spec.line(text, next, peek);
    /** @type {Token[]} */
    const tokens = [];
    runTokens(spec, text, 0, text.length, next, peek, tokens);
    return { tokens, state: next };
  },
});

/**
 * @param {TokenType} type
 * @param {number} from
 * @param {number} to
 * @param {boolean} [mark]
 * @returns {Token}
 */
export const token = (type, from, to, mark = false) => (mark ? { from, to, type, mark: true } : { from, to, type });
