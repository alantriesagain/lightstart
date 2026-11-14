/**
 * @file JavaScript (and JSON, and TypeScript with its own keywords) tokenizer, ported from
 * @bootstrapp/editor's lang/javascript.js: template literals nest through a frame stack in the
 * state; regex versus division follows what the previous significant token allows. A token
 * function answers the token type, or "" for text that gets no color.
 */
import { HlState, Frame } from "./state.ts";
import { readString, Stream } from "./stream.ts";

const KEYWORDS = new Set<string>(
  "break case catch class const continue debugger default delete do else enum export extends finally for function if import in instanceof new return super switch this throw try typeof var void while with yield let static async await of as from get set".split(" "),
);
const TS_KEYWORDS = new Set<string>("interface type implements private public protected readonly declare namespace abstract keyof satisfies infer is override module unique asserts".split(" "));
const ATOMS = new Set<string>(["true", "false", "null", "undefined", "NaN", "Infinity"]);
const DECLARERS = new Set<string>(["function", "class", "const", "let", "var"]);
const TS_DECLARERS = new Set<string>(["interface", "type", "enum", "namespace"]);
const NO_REGEX_AFTER = new Set<string>(["this", "super"]);

const NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/y;
const WORD = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const OPERATOR = /(?:>>>=|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|\+\+|--|\*\*|&&|\|\||\?\?|\?\.|\.\.\.|[-+*/%&|^!=<>]=?|[~?:])/y;
const COMMENT_END = /.*?\*\//y;
const ESCAPE = /\\./y;
const COLON_AHEAD = /\s*:/y;
const SPREAD = /\.\.\./y;
const FLAGS = /[dgimsuyv]/;

/** Read to the closing quote; false when the line ended first. */


const readRegex = (stream: Stream): void => {
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
  stream.eatWhileClass(FLAGS);
};

const templateText = (stream: Stream, state: HlState): string => {
  const stack = state.stack;
  if (stream.match(ESCAPE, true) !== null) return "escape";
  if (stream.take("${", true)) {
    stack.push(new Frame("expr"));
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
    if (ch === "`" || ch === "\\" || (ch === "$" && stream.text.charAt(stream.pos + 1) === "{")) break;
    stream.next();
  }
  return "string";
};

export const jsToken = (stream: Stream, state: HlState, typescript: boolean): string => {
  if (state.comment) {
    if (stream.match(COMMENT_END, true) !== null) state.comment = false;
    else stream.skipToEnd();
    return "comment";
  }
  if (state.string.length > 0) {
    const quote = state.string;
    state.string = "";
    if (!readString(stream, quote) && stream.text.endsWith("\\")) state.string = quote;
    return "string";
  }
  const stack = state.stack;
  const frame = stack.length > 0 ? stack[stack.length - 1] : null;
  if (frame !== null && frame.kind === "tpl") return templateText(stream, state);
  if (stream.eatSpace()) return "";
  const wasObjKey = state.objKey;
  const afterDot = state.afterDot;
  state.objKey = false;
  state.afterDot = false;
  if (stream.take("//", true)) {
    stream.skipToEnd();
    state.objKey = wasObjKey;
    state.afterDot = afterDot;
    return "comment";
  }
  if (stream.take("/*", true)) {
    if (stream.match(COMMENT_END, true) === null) {
      stream.skipToEnd();
      state.comment = true;
    }
    state.objKey = wasObjKey;
    state.afterDot = afterDot;
    return "comment";
  }
  const ch = stream.peek();
  if (ch === '"' || ch === "'") {
    stream.next();
    if (!readString(stream, ch) && stream.text.endsWith("\\")) state.string = ch;
    state.regexOk = false;
    if (wasObjKey && stream.match(COLON_AHEAD, false) !== null) return "property";
    return "string";
  }
  if (ch === "`") {
    stream.next();
    stack.push(new Frame("tpl"));
    return "string";
  }
  if (stream.match(NUMBER, true) !== null) {
    state.regexOk = false;
    return "number";
  }
  if (ch === "/" && state.regexOk) {
    stream.next();
    readRegex(stream);
    state.regexOk = false;
    return "regexp";
  }
  const word = stream.match(WORD, true);
  if (word !== null) {
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
    if (wasObjKey && stream.match(COLON_AHEAD, false) !== null) {
      state.regexOk = false;
      return "property";
    }
    if (KEYWORDS.has(w) || (typescript && TS_KEYWORDS.has(w))) {
      state.regexOk = !NO_REGEX_AFTER.has(w);
      state.decl = DECLARERS.has(w) || (typescript && TS_DECLARERS.has(w));
      return "keyword";
    }
    state.regexOk = false;
    if (ATOMS.has(w)) return "atom";
    return "variable";
  }
  if (ch === "{" || ch === "}" || ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === ";" || ch === ",") {
    stream.next();
    if (ch === "{") {
      if (frame !== null && frame.kind === "expr") frame.braces++;
      state.decl = false;
    } else if (ch === "}" && frame !== null && frame.kind === "expr") {
      if (frame.braces === 0) {
        stack.pop();
        state.regexOk = false;
        return "punctuation";
      }
      frame.braces--;
    }
    state.regexOk = ch !== ")" && ch !== "]";
    state.objKey = ch === "{" || ch === ",";
    if (ch === "{") state.decl = false;
    return "punctuation";
  }
  if (ch === "." && stream.match(SPREAD, false) === null) {
    stream.next();
    state.afterDot = true;
    state.regexOk = false;
    return "punctuation";
  }
  const op = stream.match(OPERATOR, true);
  if (op !== null) {
    state.afterDot = op[0] === "?.";
    state.regexOk = true;
    state.decl = false;
    return "operator";
  }
  stream.next();
  return "";
};
