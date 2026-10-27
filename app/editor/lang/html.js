/**
 * HTML tokenizer. `<script>` and `<style>` bodies delegate to the
 * JavaScript and CSS modes through a nested state, so they resume across
 * lines like any other multi-line construct.
 */

/** @import { ModeSpec, State, Stream, TokenType } from "../types.js" */
import { cssSpec } from "./css.js";
import { javascriptSpec } from "./javascript.js";
import { defineMode } from "./mode.js";

const TEXT = 0;
const TAG = 1;
const VALUE = 2;
const COMMENT = 3;
const RAW = 4;

const JS_TYPES = new Set(["", "module", "text/javascript", "application/javascript", "text/ecmascript", "importmap"]);

/** @type {Record<string, ModeSpec>} */
const INNER = { javascript: javascriptSpec, css: cssSpec };

/**
 * @param {Stream} stream
 * @param {string} quote
 * @returns {boolean} closed on this line
 */
const readUntil = (stream, quote) => {
  while (!stream.eol()) if (stream.next() === quote) return true;
  return false;
};

/**
 * @param {State} state
 * @returns {string | null}
 */
const rawLanguage = (state) => {
  if (state.tagName === "style") return "css";
  if (state.tagName === "script") {
    const type = String(state.scriptType ?? "").toLowerCase();
    return JS_TYPES.has(type) || type === "importmap" ? "javascript" : null;
  }
  return null;
};

/** @type {ModeSpec} */
export const htmlSpec = {
  name: "html",
  lookAhead: 0,
  startState: () => ({ mode: TEXT, quote: null, tagName: "", closing: false, nameNext: false, afterEq: false, attrName: "", scriptType: null, raw: null }),
  indentAfter: (before) => (/<[a-zA-Z][^>]*[^/]>\s*$/.test(before) && !/<\/[a-zA-Z]+>\s*$/.test(before) ? 1 : 0),
  token(stream, state, peek) {
    if (state.mode === COMMENT) {
      if (stream.match(/^.*?-->/)) state.mode = TEXT;
      else stream.skipToEnd();
      return "comment";
    }
    if (state.mode === RAW) {
      const raw = /** @type {{ tag: string, lang: string | null, state: State }} */ (state.raw);
      const end = stream.string.toLowerCase().indexOf(`</${raw.tag}`, stream.pos);
      const limit = end === -1 ? stream.end : end;
      if (stream.pos >= limit && end !== -1) {
        state.mode = TEXT;
        state.raw = null;
      } else {
        if (!raw.lang) {
          stream.pos = limit;
          return null;
        }
        const inner = stream.sub(limit);
        inner.start = stream.pos;
        const type = /** @type {ModeSpec & { token: NonNullable<ModeSpec["token"]> }} */ (INNER[raw.lang]).token(inner, raw.state, peek);
        stream.pos = inner.pos;
        return type;
      }
    }
    if (state.mode === VALUE) {
      if (readUntil(stream, /** @type {string} */ (state.quote))) {
        state.mode = TAG;
        state.quote = null;
      }
      return "string";
    }
    if (state.mode === TAG) {
      if (state.nameNext) {
        state.nameNext = false;
        const name = stream.match(/^[a-zA-Z][\w:.-]*/);
        if (name) {
          state.tagName = name[0].toLowerCase();
          return "tag";
        }
      }
      if (stream.eatSpace()) return null;
      const close = stream.match(/^\/?>/);
      if (close) {
        state.mode = TEXT;
        state.afterEq = false;
        if (!state.closing && close[0] === ">") {
          const lang = rawLanguage(state);
          if (state.tagName === "script" || state.tagName === "style") {
            state.mode = RAW;
            state.raw = { tag: state.tagName, lang, state: lang ? INNER[lang].startState() : {} };
          }
        }
        state.scriptType = null;
        state.tagName = "";
        state.closing = false;
        return "punctuation";
      }
      if (stream.eat("=")) {
        state.afterEq = true;
        return "operator";
      }
      const ch = stream.peek() ?? "";
      if (ch === '"' || ch === "'") {
        stream.next();
        const closed = readUntil(stream, ch);
        if (!closed) {
          state.mode = VALUE;
          state.quote = ch;
        }
        if (state.afterEq && state.attrName === "type") state.scriptType = stream.current().slice(1, closed ? -1 : undefined);
        state.afterEq = false;
        return "string";
      }
      if (state.afterEq) {
        stream.match(/^[^\s>]+/);
        if (state.attrName === "type") state.scriptType = stream.current();
        state.afterEq = false;
        return "string";
      }
      const attr = stream.match(/^[^\s=>/'"]+/);
      if (attr) {
        state.attrName = attr[0].toLowerCase();
        return "attribute";
      }
      stream.next();
      return null;
    }
    if (stream.match("<!--")) {
      if (stream.match(/^.*?-->/)) return "comment";
      stream.skipToEnd();
      state.mode = COMMENT;
      return "comment";
    }
    if (stream.match(/^<!doctype[^>]*>?/i)) return "meta";
    const open = stream.match(/^<\/?(?=[a-zA-Z])/);
    if (open) {
      state.mode = TAG;
      state.closing = open[0] === "</";
      state.nameNext = true;
      state.attrName = "";
      return "punctuation";
    }
    if (stream.match(/^&(?:#x[\da-fA-F]+|#\d+|[a-zA-Z]\w*);/)) return "escape";
    stream.next();
    while (!stream.eol() && stream.peek() !== "<" && stream.peek() !== "&") stream.next();
    return null;
  },
};

export default defineMode(htmlSpec);
