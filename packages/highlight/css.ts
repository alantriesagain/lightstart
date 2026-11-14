/**
 * @file CSS tokenizer, ported from @bootstrapp/editor's lang/css.js. Each statement inside a block is a
 * nested rule when its line reaches a `{` before a `;`, a declaration otherwise; that one rule
 * covers nesting without more machinery.
 */
import { HlState } from "./state.ts";
import { readString, Stream } from "./stream.ts";

const IDENT = /-?[_a-zA-Z -￿][\w -￿-]*/y;
const NUMBER = /[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?(?:%|[a-zA-Z]+)?/y;
const HEX = /#[0-9a-fA-F]{3,8}\b/y;
const PRELUDE_KEYWORDS = new Set<string>(["and", "not", "only", "or", "screen", "print", "all", "from", "to"]);
const COMMENT_END = /.*?\*\//y;
const BLANK_REST = /\s*$/y;
const AT_AHEAD = /\s*@/y;
const RULE_AHEAD = /[^;{}]*\{/y;
const LIST_AHEAD = /[^;{}]*,\s*$/y;
const NEST_AHEAD = /\s*&/y;
const PSEUDO = /::?[\w-]+/y;
const CLASS_OR_ID = /[.#][\w-]+/y;
const ATTRIBUTE = /\[[^\]]*\]?/y;
const PERCENT = /%/y;
const COMBINATOR = /[>+~*&]/y;
const SELECTOR_PUNCT = /[,()]/y;
const AT_RULE = /@[\w-]+/y;
const PRELUDE_PUNCT = /[():,]/y;
const COLON_AHEAD = /\s*:/y;
const CUSTOM_PROPERTY = /--[\w-]+/y;
const IMPORTANT = /!\s*important\b/y;
const FUNCTION = /(-?[\w-]+)\(/y;
const VALUE_PUNCT = /[,/()]/y;



const decideStart = (stream: Stream, state: HlState): boolean => {
  if (stream.match(BLANK_REST, false) !== null) return false;
  if (state.depth === 0) {
    state.mode = stream.match(AT_AHEAD, false) !== null ? "prelude" : "selector";
    return true;
  }
  if (stream.match(AT_AHEAD, false) !== null) state.mode = "prelude";
  else if (stream.match(RULE_AHEAD, false) !== null || stream.match(LIST_AHEAD, false) !== null || stream.match(NEST_AHEAD, false) !== null) state.mode = "selector";
  else state.mode = "property";
  return true;
};

/** A brace or semicolon: its token type; "?" when `ch` is not structural. */
const structural = (stream: Stream, state: HlState, ch: string): string => {
  if (ch === "{") {
    stream.next();
    state.depth++;
    state.mode = "start";
    return "punctuation";
  }
  if (ch === "}") {
    stream.next();
    state.depth = Math.max(0, state.depth - 1);
    state.mode = "start";
    return "punctuation";
  }
  if (ch === ";") {
    stream.next();
    state.mode = "start";
    return "punctuation";
  }
  return "?";
};

export const cssToken = (stream: Stream, state: HlState): string => {
  if (state.comment) {
    if (stream.match(COMMENT_END, true) !== null) state.comment = false;
    else stream.skipToEnd();
    return "comment";
  }
  if (state.string.length > 0) {
    const quote = state.string;
    state.string = "";
    if (!readString(stream, quote)) state.string = quote;
    return "string";
  }
  if (state.url) {
    if (stream.eat(")")) {
      state.url = false;
      return "punctuation";
    }
    if (stream.eatSpace()) return "";
    const ch = stream.peek();
    if (ch === '"' || ch === "'") {
      stream.next();
      if (!readString(stream, ch)) state.string = ch;
      return "string";
    }
    while (!stream.eol() && stream.peek() !== ")") stream.next();
    return "string";
  }
  if (stream.eatSpace()) return "";
  if (stream.take("/*", true)) {
    if (stream.match(COMMENT_END, true) === null) {
      stream.skipToEnd();
      state.comment = true;
    }
    return "comment";
  }
  if (state.mode === "start" && !decideStart(stream, state)) {
    stream.skipToEnd();
    return "";
  }
  const ch = stream.peek();
  if (ch === '"' || ch === "'") {
    stream.next();
    if (!readString(stream, ch)) state.string = ch;
    return "string";
  }
  const mode = state.mode;
  if (mode === "selector") {
    const s = structural(stream, state, ch);
    if (s !== "?") return s;
    if (stream.match(PSEUDO, true) !== null) return "keyword";
    if (stream.match(CLASS_OR_ID, true) !== null) return "attribute";
    if (stream.match(ATTRIBUTE, true) !== null) return "attribute";
    if (stream.match(IDENT, true) !== null || stream.match(PERCENT, true) !== null) return "tag";
    if (stream.match(COMBINATOR, true) !== null) return "operator";
    if (stream.match(SELECTOR_PUNCT, true) !== null) return "punctuation";
    stream.next();
    return "";
  }
  if (mode === "prelude") {
    if (stream.match(AT_RULE, true) !== null) return "meta";
    const s = structural(stream, state, ch);
    if (s !== "?") return s;
    if (stream.match(PRELUDE_PUNCT, true) !== null) return "punctuation";
    if (stream.match(NUMBER, true) !== null) return "number";
    const word = stream.match(IDENT, true);
    if (word !== null) {
      if (PRELUDE_KEYWORDS.has(word[0])) return "keyword";
      if (stream.match(COLON_AHEAD, false) !== null) return "property";
      return "variable";
    }
    stream.next();
    return "";
  }
  if (mode === "property") {
    const s = structural(stream, state, ch);
    if (s !== "?") return s;
    if (ch === ":") {
      stream.next();
      state.mode = "value";
      return "punctuation";
    }
    if (stream.match(CUSTOM_PROPERTY, true) !== null || stream.match(IDENT, true) !== null) return "property";
    stream.next();
    return "";
  }
  const s = structural(stream, state, ch);
  if (s !== "?") return s;
  if (stream.match(IMPORTANT, true) !== null) return "atom";
  if (stream.match(HEX, true) !== null) return "atom";
  if (stream.match(CUSTOM_PROPERTY, true) !== null) return "variable";
  const fn = stream.match(FUNCTION, true);
  if (fn !== null) {
    if (fn[1] === "url") state.url = true;
    return "variable";
  }
  if (stream.match(NUMBER, true) !== null) return "number";
  if (stream.match(IDENT, true) !== null) return "";
  if (stream.match(VALUE_PUNCT, true) !== null) return "punctuation";
  stream.next();
  return "";
};
