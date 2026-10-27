/**
 * JavaScript tokenizer (JSON shares it). Template literals nest through a
 * frame stack in the state; regex versus division follows what the previous
 * significant token allows.
 */

/** @import { ModeSpec, State, Stream, TokenType } from "../types.js" */
import { defineMode } from "./mode.js";

const KEYWORDS = new Set(
  "break case catch class const continue debugger default delete do else enum export extends finally for function if import in instanceof new return super switch this throw try typeof var void while with yield let static async await of as from get set".split(" "),
);
const ATOMS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
const DECLARERS = new Set(["function", "class", "const", "let", "var"]);
const NO_REGEX_AFTER = new Set(["this", "super"]);

const NUMBER = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/;
const WORD = /^[\p{L}_$][\p{L}\p{N}_$]*/u;
const OPERATOR = /^(?:>>>=|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|\+\+|--|\*\*|&&|\|\||\?\?|\?\.|\.\.\.|[-+*/%&|^!=<>]=?|[~?:])/;

/**
 * @param {Stream} stream
 * @param {string} quote
 * @returns {boolean} true when the string closed on this line
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
 */
const readRegex = (stream) => {
  let inClass = false;
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === "\\") {
      stream.next();
      continue;
    }
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) break;
  }
  stream.eatWhile(/[dgimsuyv]/);
};

/**
 * @param {Stream} stream
 * @param {State} state
 * @returns {TokenType | null}
 */
const templateText = (stream, state) => {
  const stack = /** @type {Array<Record<string, unknown>>} */ (state.stack);
  if (stream.match(/^\\./)) return "escape";
  if (stream.match("${")) {
    stack.push({ kind: "expr", braces: 0 });
    state.regexOk = true;
    return "punctuation";
  }
  if (stream.eat("`")) {
    stack.pop();
    state.regexOk = false;
    return "string";
  }
  while (!stream.eol()) {
    const ch = stream.peek();
    if (ch === "`" || ch === "\\" || (ch === "$" && stream.string[stream.pos + 1] === "{")) break;
    stream.next();
  }
  return "string";
};

/** @type {ModeSpec} */
export const javascriptSpec = {
  name: "javascript",
  lineComment: "//",
  startState: () => ({ stack: [], comment: false, string: null, regexOk: true, decl: false, afterDot: false, objKey: false }),
  indentAfter: (before) => (/(?:[{([]|=>)\s*$/.test(before) ? 1 : 0),
  token(stream, state) {
    if (state.comment) {
      if (stream.match(/^.*?\*\//)) state.comment = false;
      else stream.skipToEnd();
      return "comment";
    }
    if (typeof state.string === "string") {
      const quote = state.string;
      state.string = null;
      if (!readString(stream, quote) && stream.string.endsWith("\\")) state.string = quote;
      return "string";
    }
    const stack = /** @type {Array<Record<string, unknown>>} */ (state.stack);
    const frame = stack[stack.length - 1];
    if (frame && frame.kind === "tpl") return templateText(stream, state);
    if (stream.eatSpace()) return null;
    const wasObjKey = state.objKey;
    const afterDot = state.afterDot;
    state.objKey = false;
    state.afterDot = false;
    if (stream.match("//")) {
      stream.skipToEnd();
      state.objKey = wasObjKey;
      state.afterDot = afterDot;
      return "comment";
    }
    if (stream.match("/*")) {
      if (!stream.match(/^.*?\*\//)) {
        stream.skipToEnd();
        state.comment = true;
      }
      state.objKey = wasObjKey;
      state.afterDot = afterDot;
      return "comment";
    }
    const ch = stream.peek() ?? "";
    if (ch === '"' || ch === "'") {
      stream.next();
      if (!readString(stream, ch) && stream.string.endsWith("\\")) state.string = ch;
      state.regexOk = false;
      if (wasObjKey && stream.match(/^\s*:/, false)) return "property";
      return "string";
    }
    if (ch === "`") {
      stream.next();
      stack.push({ kind: "tpl" });
      return "string";
    }
    if (stream.match(NUMBER)) {
      state.regexOk = false;
      return "number";
    }
    if (ch === "/" && state.regexOk) {
      stream.next();
      readRegex(stream);
      state.regexOk = false;
      return "regexp";
    }
    const word = stream.match(WORD);
    if (word) {
      const w = word[0];
      if (afterDot) {
        state.regexOk = false;
        return "property";
      }
      if (state.decl) {
        state.decl = false;
        state.regexOk = false;
        return "definition";
      }
      if (KEYWORDS.has(w)) {
        state.regexOk = !NO_REGEX_AFTER.has(w);
        state.decl = DECLARERS.has(w);
        return "keyword";
      }
      state.regexOk = false;
      if (ATOMS.has(w)) return "atom";
      if (wasObjKey && stream.match(/^\s*:/, false)) return "property";
      return "variable";
    }
    if (ch === "{" || ch === "}" || ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === ";" || ch === ",") {
      stream.next();
      if (ch === "{") {
        if (frame && frame.kind === "expr") frame.braces = /** @type {number} */ (frame.braces) + 1;
        state.decl = false;
      } else if (ch === "}" && frame && frame.kind === "expr") {
        if (frame.braces === 0) {
          stack.pop();
          state.regexOk = false;
          return "punctuation";
        }
        frame.braces = /** @type {number} */ (frame.braces) - 1;
      }
      state.regexOk = ch !== ")" && ch !== "]";
      state.objKey = ch === "{" || ch === ",";
      if (ch === "{") state.decl = false;
      return "punctuation";
    }
    if (ch === "." && !stream.match(/^\.\.\./, false)) {
      stream.next();
      state.afterDot = true;
      state.regexOk = false;
      return "punctuation";
    }
    const op = stream.match(OPERATOR);
    if (op) {
      state.afterDot = op[0] === "?.";
      state.regexOk = true;
      state.decl = false;
      return "operator";
    }
    stream.next();
    return null;
  },
};

export default defineMode(javascriptSpec);
