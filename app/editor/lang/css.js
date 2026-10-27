/**
 * CSS tokenizer. Each statement inside a block is a nested rule when its
 * line reaches a `{` before a `;`, a declaration otherwise; that one rule
 * covers nesting without more machinery.
 */

/** @import { ModeSpec, State, Stream, TokenType } from "../types.js" */
import { defineMode } from "./mode.js";

const IDENT = /^-?[_a-zA-Z -￿][\w -￿-]*/;
const NUMBER = /^[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?(?:%|[a-zA-Z]+)?/;
const HEX = /^#[0-9a-fA-F]{3,8}\b/;
const PRELUDE_KEYWORDS = new Set(["and", "not", "only", "or", "screen", "print", "all", "from", "to"]);

/**
 * @param {Stream} stream
 * @param {string} quote
 * @returns {boolean} closed on this line
 */
const readString = (stream, quote) => {
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === "\\") {
      if (stream.eol()) return false;
      stream.next();
      continue;
    }
    if (ch === quote) return true;
  }
  return true;
};

/**
 * @param {Stream} stream
 * @param {State} state
 * @returns {boolean}
 */
const decideStart = (stream, state) => {
  if (stream.match(/^\s*$/, false)) return false;
  if (state.depth === 0) {
    state.mode = stream.match(/^\s*@/, false) ? "prelude" : "selector";
    return true;
  }
  if (stream.match(/^\s*@/, false)) state.mode = "prelude";
  else if (stream.match(/^[^;{}]*\{/, false) || stream.match(/^[^;{}]*,\s*$/, false) || stream.match(/^\s*&/, false)) state.mode = "selector";
  else state.mode = "property";
  return true;
};

/**
 * @param {Stream} stream
 * @param {State} state
 * @param {string} ch
 * @returns {TokenType | null | undefined} undefined when `ch` is not structural
 */
const structural = (stream, state, ch) => {
  if (ch === "{") {
    stream.next();
    state.depth = /** @type {number} */ (state.depth) + 1;
    state.mode = "start";
    return "punctuation";
  }
  if (ch === "}") {
    stream.next();
    state.depth = Math.max(0, /** @type {number} */ (state.depth) - 1);
    state.mode = "start";
    return "punctuation";
  }
  if (ch === ";") {
    stream.next();
    state.mode = "start";
    return "punctuation";
  }
  return undefined;
};

/** @type {ModeSpec} */
export const cssSpec = {
  name: "css",
  startState: () => ({ depth: 0, mode: "start", comment: false, string: null, url: false }),
  indentAfter: (before) => (/\{\s*$/.test(before) ? 1 : 0),
  token(stream, state) {
    if (state.comment) {
      if (stream.match(/^.*?\*\//)) state.comment = false;
      else stream.skipToEnd();
      return "comment";
    }
    if (typeof state.string === "string") {
      const quote = state.string;
      state.string = null;
      if (!readString(stream, quote)) state.string = quote;
      return "string";
    }
    if (state.url) {
      if (stream.eat(")")) {
        state.url = false;
        return "punctuation";
      }
      if (stream.eatSpace()) return null;
      const ch = stream.peek();
      if (ch === '"' || ch === "'") {
        stream.next();
        if (!readString(stream, ch)) state.string = ch;
        return "string";
      }
      while (!stream.eol() && stream.peek() !== ")") stream.next();
      return "string";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("/*")) {
      if (!stream.match(/^.*?\*\//)) {
        stream.skipToEnd();
        state.comment = true;
      }
      return "comment";
    }
    if (state.mode === "start" && !decideStart(stream, state)) {
      stream.skipToEnd();
      return null;
    }
    const ch = stream.peek() ?? "";
    if (ch === '"' || ch === "'") {
      stream.next();
      if (!readString(stream, ch)) state.string = ch;
      return "string";
    }
    const mode = state.mode;
    if (mode === "selector") {
      const s = structural(stream, state, ch);
      if (s !== undefined) return s;
      if (stream.match(/^::?[\w-]+/)) return "keyword";
      if (stream.match(/^[.#][\w-]+/)) return "attribute";
      if (stream.match(/^\[[^\]]*\]?/)) return "attribute";
      if (stream.match(IDENT) || stream.match(/^%/)) return "tag";
      if (stream.match(/^[>+~*&]/)) return "operator";
      if (stream.match(/^[,()]/)) return "punctuation";
      stream.next();
      return null;
    }
    if (mode === "prelude") {
      if (stream.match(/^@[\w-]+/)) return "meta";
      const s = structural(stream, state, ch);
      if (s !== undefined) return s;
      if (stream.match(/^[():,]/)) return "punctuation";
      if (stream.match(NUMBER)) return "number";
      const word = stream.match(IDENT);
      if (word) {
        if (PRELUDE_KEYWORDS.has(word[0])) return "keyword";
        if (stream.match(/^\s*:/, false)) return "property";
        return "variable";
      }
      stream.next();
      return null;
    }
    if (mode === "property") {
      const s = structural(stream, state, ch);
      if (s !== undefined) return s;
      if (ch === ":") {
        stream.next();
        state.mode = "value";
        return "punctuation";
      }
      if (stream.match(/^--[\w-]+/) || stream.match(IDENT)) return "property";
      stream.next();
      return null;
    }
    const s = structural(stream, state, ch);
    if (s !== undefined) return s;
    if (stream.match(/^!\s*important\b/)) return "atom";
    if (stream.match(HEX)) return "atom";
    if (stream.match(/^--[\w-]+/)) return "variable";
    const fn = stream.match(/^(-?[\w-]+)\(/);
    if (fn) {
      if (fn[1] === "url") state.url = true;
      return "variable";
    }
    if (stream.match(NUMBER)) return "number";
    if (stream.match(IDENT)) return null;
    if (stream.match(/^[,/()]/)) return "punctuation";
    stream.next();
    return null;
  },
};

export default defineMode(cssSpec);
