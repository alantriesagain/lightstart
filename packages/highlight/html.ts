/**
 * @file HTML tokenizer, ported from @bootstrapp/editor's lang/html.js. `<script>` and `<style>` bodies
 * go to the JavaScript and CSS tokenizers through a nested state, so they resume across lines
 * like any other multi-line construct.
 */
import { cssToken } from "./css.ts";
import { jsToken } from "./javascript.ts";
import { HlState } from "./state.ts";
import { Stream } from "./stream.ts";

const TEXT = 0;
const TAG = 1;
const VALUE = 2;
const COMMENT = 3;
const RAW = 4;

const JS_TYPES = new Set<string>(["", "module", "text/javascript", "application/javascript", "text/ecmascript", "importmap"]);
const COMMENT_END = /.*?-->/y;
const TAG_NAME = /[a-zA-Z][\w:.-]*/y;
const TAG_CLOSE = /\/?>/y;
const UNQUOTED = /[^\s>]+/y;
const ATTRIBUTE = /[^\s=>/'"]+/y;
const DOCTYPE = /<!doctype[^>]*>?/iy;
const OPEN = /<\/?(?=[a-zA-Z])/y;
const ENTITY = /&(?:#x[\da-fA-F]+|#\d+|[a-zA-Z]\w*);/y;

const readUntil = (stream: Stream, quote: string): boolean => {
  while (!stream.eol()) if (stream.next() === quote) return true;
  return false;
};

/** The language of a raw element's body, "" when it gets no color. */
const rawLanguage = (state: HlState): string => {
  if (state.tagName === "style") return "css";
  if (state.tagName === "script") return JS_TYPES.has(state.hasScriptType ? state.scriptType.toLowerCase() : "") ? "javascript" : "";
  return "";
};

export const htmlToken = (stream: Stream, state: HlState): string => {
  if (state.hmode === COMMENT) {
    if (stream.match(COMMENT_END, true) !== null) state.hmode = TEXT;
    else stream.skipToEnd();
    return "comment";
  }
  if (state.hmode === RAW) {
    const end = stream.text.toLowerCase().indexOf("</" + state.rawTag, stream.pos);
    const limit = end === -1 ? stream.end : end;
    if (stream.pos >= limit && end !== -1) {
      state.hmode = TEXT;
      state.inner = null;
      state.rawLang = "";
    } else {
      const inner = state.inner;
      if (state.rawLang.length === 0 || inner === null) {
        stream.pos = limit;
        return "";
      }
      const sub = stream.sub(limit);
      sub.start = stream.pos;
      const type = state.rawLang === "css" ? cssToken(sub, inner) : jsToken(sub, inner, false);
      stream.pos = sub.pos;
      return type;
    }
  }
  if (state.hmode === VALUE) {
    if (readUntil(stream, state.quote)) {
      state.hmode = TAG;
      state.quote = "";
    }
    return "string";
  }
  if (state.hmode === TAG) {
    if (state.nameNext) {
      state.nameNext = false;
      const name = stream.match(TAG_NAME, true);
      if (name !== null) {
        state.tagName = name[0].toLowerCase();
        return "tag";
      }
    }
    if (stream.eatSpace()) return "";
    const close = stream.match(TAG_CLOSE, true);
    if (close !== null) {
      state.hmode = TEXT;
      state.afterEq = false;
      if (!state.closing && close[0] === ">" && (state.tagName === "script" || state.tagName === "style")) {
        state.hmode = RAW;
        state.rawTag = state.tagName;
        state.rawLang = rawLanguage(state);
        state.inner = state.rawLang.length > 0 ? new HlState() : null;
      }
      state.scriptType = "";
      state.hasScriptType = false;
      state.tagName = "";
      state.closing = false;
      return "punctuation";
    }
    if (stream.eat("=")) {
      state.afterEq = true;
      return "operator";
    }
    const ch = stream.peek();
    if (ch === '"' || ch === "'") {
      stream.next();
      const closed = readUntil(stream, ch);
      if (!closed) {
        state.hmode = VALUE;
        state.quote = ch;
      }
      if (state.afterEq && state.attrName === "type") {
        const value = stream.current();
        state.scriptType = closed ? value.slice(1, value.length - 1) : value.slice(1);
        state.hasScriptType = true;
      }
      state.afterEq = false;
      return "string";
    }
    if (state.afterEq) {
      stream.match(UNQUOTED, true);
      if (state.attrName === "type") {
        state.scriptType = stream.current();
        state.hasScriptType = true;
      }
      state.afterEq = false;
      return "string";
    }
    const attr = stream.match(ATTRIBUTE, true);
    if (attr !== null) {
      state.attrName = attr[0].toLowerCase();
      return "attribute";
    }
    stream.next();
    return "";
  }
  if (stream.take("<!--", true)) {
    if (stream.match(COMMENT_END, true) !== null) return "comment";
    stream.skipToEnd();
    state.hmode = COMMENT;
    return "comment";
  }
  if (stream.match(DOCTYPE, true) !== null) return "meta";
  const open = stream.match(OPEN, true);
  if (open !== null) {
    state.hmode = TAG;
    state.closing = open[0] === "</";
    state.nameNext = true;
    state.attrName = "";
    return "punctuation";
  }
  if (stream.match(ENTITY, true) !== null) return "escape";
  stream.next();
  while (!stream.eol() && stream.peek() !== "<" && stream.peek() !== "&") stream.next();
  return "";
};
