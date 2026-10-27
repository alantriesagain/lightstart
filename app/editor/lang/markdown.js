/**
 * Markdown tokenizer. One call classifies a whole line (block kind, quote
 * depth, inline spans) and answers both the tokens and the `md` structure a
 * live preview needs. Fenced code delegates to the other tokenizers.
 */

/** @import { ModeSpec, State, Token, TokenType, MdBlock, MdSpan, MdLine, Range, Peek, LineResult } from "../types.js" */
import { languageName } from "./aliases.js";
import { cssSpec } from "./css.js";
import { htmlSpec } from "./html.js";
import { javascriptSpec } from "./javascript.js";
import { defineMode, pushToken, runTokens } from "./mode.js";

/** @type {Record<string, ModeSpec>} */
const INNER = { javascript: javascriptSpec, css: cssSpec, html: htmlSpec };

const QUOTE = /^ {0,3}> ?/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+|$)/;
const ATX_CLOSE = /[ \t]+#+[ \t]*$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+)/;
const TASK = /^\[([ xX])\][ \t]/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const PUNCT = /[!-/:-@[-`{-~]/;

/** @type {Record<MdSpan["type"], TokenType>} */
const SPAN_TYPES = {
  code: "code",
  emphasis: "emphasis",
  strong: "strong",
  strikethrough: "strikethrough",
  link: "link",
  image: "link",
  wiki: "link",
  autolink: "url",
  tag: "meta",
  escape: "escape",
  html: "tag",
};

/**
 * @param {string} text
 * @param {number} i
 * @returns {boolean}
 */
const isSpace = (text, i) => i < 0 || i >= text.length || /\s/.test(text[i]);

/**
 * @param {string} text
 * @param {number} i
 * @returns {boolean}
 */
const isWordChar = (text, i) => i >= 0 && i < text.length && /[\p{L}\p{N}_]/u.test(text[i]);

/**
 * @param {string} text
 * @param {number} i
 * @param {number} len
 * @param {string} ch
 * @returns {{ open: boolean, close: boolean }}
 */
const flanking = (text, i, len, ch) => {
  const before = i - 1;
  const after = i + len;
  const left = !isSpace(text, after) && (!PUNCT.test(text[after] ?? "") || isSpace(text, before) || PUNCT.test(text[before] ?? ""));
  const right = !isSpace(text, before) && (!PUNCT.test(text[before] ?? "") || isSpace(text, after) || PUNCT.test(text[after] ?? ""));
  if (ch === "_") return { open: left && (!right || PUNCT.test(text[before] ?? "")) && !isWordChar(text, before), close: right && (!left || PUNCT.test(text[after] ?? "")) && !isWordChar(text, after) };
  return { open: left, close: right };
};

/**
 * @typedef {{ ch: string, pos: number, len: number, origLen: number, canOpen: boolean, canClose: boolean }} Delim
 */

/**
 * CommonMark's delimiter run processing: every closer pairs with the nearest
 * matching opener, the rule of three keeps `**a *b* c**` honest.
 * @param {Delim[]} delims
 * @param {MdSpan[]} spans
 */
const processEmphasis = (delims, spans) => {
  for (let ci = 0; ci < delims.length; ci++) {
    const closer = delims[ci];
    if (!closer.canClose || closer.len === 0) continue;
    let oi = ci - 1;
    while (oi >= 0) {
      const opener = delims[oi];
      const oddMatch =
        (opener.canClose || closer.canOpen) &&
        (opener.origLen + closer.origLen) % 3 === 0 &&
        !(opener.origLen % 3 === 0 && closer.origLen % 3 === 0);
      if (opener.len > 0 && opener.canOpen && opener.ch === closer.ch && !(closer.ch !== "~" && oddMatch)) break;
      oi--;
    }
    if (oi < 0) continue;
    const opener = delims[oi];
    if (closer.ch === "~" && (opener.len < 2 || closer.len < 2)) continue;
    const width = closer.ch === "~" ? 2 : opener.len >= 2 && closer.len >= 2 ? 2 : 1;
    const openFrom = opener.pos + opener.len - width;
    const closeFrom = closer.pos;
    /** @type {MdSpan["type"]} */
    const type = closer.ch === "~" ? "strikethrough" : width === 2 ? "strong" : "emphasis";
    spans.push({ type, from: openFrom, to: closeFrom + width, open: { from: openFrom, to: openFrom + width }, close: { from: closeFrom, to: closeFrom + width } });
    opener.len -= width;
    closer.len -= width;
    closer.pos += width;
    for (let k = oi + 1; k < ci; k++) delims[k].len = 0;
    if (closer.len > 0) ci--;
  }
};

/**
 * @param {string} text
 * @param {number} from
 * @param {number} to
 * @param {MdSpan[]} spans
 */
const scanInline = (text, from, to, spans) => {
  /** @type {Delim[]} */
  const delims = [];
  let i = from;
  /**
   * @param {MdSpan} span
   * @param {number} contentFrom
   * @param {number} contentTo
   */
  const emit = (span, contentFrom, contentTo) => {
    spans.push(span);
    if (contentTo > contentFrom) scanInline(text, contentFrom, contentTo, spans);
  };
  while (i < to) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < to && PUNCT.test(text[i + 1])) {
      spans.push({ type: "escape", from: i, to: i + 2, open: null, close: null });
      i += 2;
      continue;
    }
    if (ch === "`") {
      let n = 0;
      while (i + n < to && text[i + n] === "`") n++;
      let end = text.indexOf("`".repeat(n), i + n);
      while (end !== -1 && end + n <= to && text[end + n] === "`") end = text.indexOf("`".repeat(n), end + n + 1);
      if (end !== -1 && end + n <= to) {
        spans.push({ type: "code", from: i, to: end + n, open: { from: i, to: i + n }, close: { from: end, to: end + n } });
        i = end + n;
        continue;
      }
      i += n;
      continue;
    }
    if (ch === "*" || ch === "_" || ch === "~") {
      let n = 0;
      while (i + n < to && text[i + n] === ch) n++;
      if (ch === "~") {
        if (n >= 2) delims.push({ ch, pos: i, len: n, origLen: n, canOpen: !isSpace(text, i + n), canClose: !isSpace(text, i - 1) });
      } else {
        const can = flanking(text, i, n, ch);
        delims.push({ ch, pos: i, len: n, origLen: n, canOpen: can.open, canClose: can.close });
      }
      i += n;
      continue;
    }
    if (ch === "!" && text[i + 1] === "[") {
      const m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(text.slice(i, to));
      if (m) {
        spans.push({ type: "image", from: i, to: i + m[0].length, open: { from: i, to: i + 2 }, close: { from: i + 2 + m[1].length, to: i + m[0].length }, url: m[2] });
        i += m[0].length;
        continue;
      }
    }
    if (ch === "[") {
      const wiki = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(text.slice(i, to));
      if (wiki) {
        const name = wiki[1].trim();
        const display = (wiki[2] ?? wiki[1]).trim();
        spans.push({ type: "wiki", from: i, to: i + wiki[0].length, open: { from: i, to: i + 2 }, close: { from: i + wiki[0].length - 2, to: i + wiki[0].length }, name, display });
        i += wiki[0].length;
        continue;
      }
      const link = /^\[((?:[^\]\\]|\\.)*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(text.slice(i, to));
      if (link) {
        const textTo = i + 1 + link[1].length;
        emit({ type: "link", from: i, to: i + link[0].length, open: { from: i, to: i + 1 }, close: { from: textTo, to: i + link[0].length }, url: link[2] }, i + 1, textTo);
        i += link[0].length;
        continue;
      }
    }
    if (ch === "<") {
      const auto = /^<((?:https?|mailto):[^>\s]+)>/.exec(text.slice(i, to));
      if (auto) {
        spans.push({ type: "autolink", from: i, to: i + auto[0].length, open: { from: i, to: i + 1 }, close: { from: i + auto[0].length - 1, to: i + auto[0].length }, url: auto[1] });
        i += auto[0].length;
        continue;
      }
      const html = /^<\/?[a-zA-Z][^>]*>/.exec(text.slice(i, to));
      if (html) {
        spans.push({ type: "html", from: i, to: i + html[0].length, open: null, close: null });
        i += html[0].length;
        continue;
      }
    }
    if (ch === "h" && (text.startsWith("http://", i) || text.startsWith("https://", i))) {
      const m = /^https?:\/\/[^\s<>)]+/.exec(text.slice(i, to));
      if (m) {
        spans.push({ type: "autolink", from: i, to: i + m[0].length, open: null, close: null, url: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (ch === "#" && isSpace(text, i - 1)) {
      const m = /^#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/u.exec(text.slice(i, to));
      if (m) {
        spans.push({ type: "tag", from: i, to: i + m[0].length, open: null, close: null, name: m[1] });
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  processEmphasis(delims, spans);
};

/**
 * @param {string} text
 * @param {number} from
 * @param {number} to
 * @param {TokenType | null} base
 * @param {MdSpan[]} spans
 * @param {Token[]} tokens
 */
const inline = (text, from, to, base, spans, tokens) => {
  const start = spans.length;
  scanInline(text, from, to, spans);
  const local = spans.slice(start).sort((a, b) => a.from - b.from || b.to - a.to);
  /** @type {Array<TokenType | null>} */
  const types = Array(to - from).fill(base);
  /** @type {boolean[]} */
  const isMark = Array(to - from).fill(false);
  const fill = (/** @type {Range | null} */ r, /** @type {TokenType} */ type, /** @type {boolean} */ mark) => {
    if (!r) return;
    for (let i = r.from; i < r.to; i++) {
      types[i - from] = type;
      isMark[i - from] = mark;
    }
  };
  for (const s of local) {
    const type = SPAN_TYPES[s.type];
    fill({ from: s.from, to: s.to }, type, s.type === "escape");
    fill(s.open, type, true);
    fill(s.close, type, true);
    if ((s.type === "link" || s.type === "image") && s.close) {
      const urlFrom = s.close.from + 2;
      const urlTo = s.url ? urlFrom + s.url.length : urlFrom;
      fill({ from: urlFrom, to: urlTo }, "url", true);
    }
  }
  for (let i = 0; i < types.length; ) {
    const type = types[i];
    const mark = isMark[i];
    let j = i + 1;
    while (j < types.length && types[j] === type && isMark[j] === mark) j++;
    if (type) pushToken(tokens, mark ? { from: from + i, to: from + j, type, mark: true } : { from: from + i, to: from + j, type });
    i = j;
  }
};

/**
 * @param {string} text
 * @param {number} off
 * @returns {Range[]} cell ranges of a table row
 */
const cellsOf = (text, off) => {
  const cells = [];
  let start = off;
  let i = off;
  const trimmed = text.trimEnd();
  const end = trimmed.length;
  const leading = /^\s*\|/.exec(text.slice(off));
  if (leading) {
    i = off + leading[0].length;
    start = i;
  }
  const closes = /\|\s*$/.test(text);
  const last = closes ? trimmed.lastIndexOf("|") : end;
  while (i < last) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === "|") {
      cells.push({ from: start, to: i });
      i++;
      start = i;
      continue;
    }
    i++;
  }
  if (last >= start) cells.push({ from: start, to: last });
  return cells;
};

/**
 * @param {string} text
 * @param {State} state
 * @param {Peek} peek
 * @returns {LineResult}
 */
const line = (text, state, peek) => {
  /** @type {Token[]} */
  const tokens = [];
  /** @type {MdSpan[]} */
  const spans = [];
  /** @type {Range[]} */
  const quoteMarks = [];
  let off = 0;
  const fence = /** @type {{ marker: string, len: number, lang: string, name: string, inner: State | null, quote: number } | null} */ (state.fence);
  const result = (/** @type {MdBlock} */ block, /** @type {"blank" | "paragraph" | "other"} */ prev) => {
    state.prev = prev;
    /** @type {MdLine} */
    const md = { block, quote: { depth: quoteMarks.length, marks: quoteMarks }, spans };
    return { tokens, state, md };
  };
  const eatQuotes = (/** @type {number} */ max) => {
    while (quoteMarks.length < max) {
      const m = QUOTE.exec(text.slice(off));
      if (!m) break;
      quoteMarks.push({ from: off, to: off + m[0].length });
      pushToken(tokens, { from: off, to: off + m[0].length, type: "quote", mark: true });
      off += m[0].length;
    }
  };
  if (fence) {
    eatQuotes(fence.quote);
    const rest = text.slice(off);
    const close = new RegExp(`^ {0,3}\\${fence.marker}{${fence.len},}\\s*$`).exec(rest);
    if (close) {
      pushToken(tokens, { from: off, to: text.length, type: "code", mark: true });
      state.fence = null;
      return result({ kind: "fence", edge: "close", lang: fence.lang }, "other");
    }
    if (fence.inner && INNER[fence.name]) runTokens(INNER[fence.name], text, off, text.length, fence.inner, peek, tokens);
    else if (text.length > off) pushToken(tokens, { from: off, to: text.length, type: "code" });
    return result({ kind: "fence", edge: null, lang: fence.lang }, "other");
  }
  if (/^\s*$/.test(text)) {
    state.table = null;
    return result({ kind: "blank" }, "blank");
  }
  eatQuotes(Infinity);
  const rest = text.slice(off);
  const table = /** @type {{ columns: number } | null} */ (state.table);
  if (quoteMarks.length === 0 && /^(?: {4}|\t)/.test(rest) && state.prev !== "paragraph") {
    state.table = null;
    pushToken(tokens, { from: off, to: text.length, type: "code" });
    return result({ kind: "code" }, "other");
  }
  let m = FENCE_OPEN.exec(rest);
  if (m) {
    state.table = null;
    const lang = m[2];
    const name = languageName(lang);
    pushToken(tokens, { from: off, to: off + m[0].length - lang.length, type: "code", mark: true });
    if (lang) pushToken(tokens, { from: off + m[0].length - lang.length, to: off + m[0].length, type: "meta" });
    state.fence = { marker: m[1][0], len: m[1].length, lang, name: name ?? "", inner: name && INNER[name] ? INNER[name].startState() : null, quote: quoteMarks.length };
    return result({ kind: "fence", edge: "open", lang }, "other");
  }
  m = ATX.exec(rest);
  if (m) {
    state.table = null;
    const level = /** @type {1 | 2 | 3 | 4 | 5 | 6} */ (m[1].length);
    const markTo = off + m[0].length;
    pushToken(tokens, { from: off, to: markTo, type: "heading", mark: true });
    const closeMark = ATX_CLOSE.exec(rest);
    const contentTo = closeMark ? off + closeMark.index : text.length;
    inline(text, markTo, Math.max(markTo, contentTo), "heading", spans, tokens);
    if (closeMark) pushToken(tokens, { from: contentTo, to: text.length, type: "heading", mark: true });
    return result({ kind: "heading", level, mark: { from: off, to: markTo } }, "other");
  }
  if (state.prev === "paragraph" && !table && SETEXT.test(rest)) {
    pushToken(tokens, { from: off, to: text.length, type: "heading", mark: true });
    return result({ kind: "setext", level: rest.trim()[0] === "=" ? 1 : 2 }, "other");
  }
  if (HR.test(rest)) {
    state.table = null;
    pushToken(tokens, { from: off, to: text.length, type: "hr", mark: true });
    return result({ kind: "hr" }, "other");
  }
  m = LIST.exec(rest);
  if (m) {
    state.table = null;
    const markTo = off + m[0].length;
    pushToken(tokens, { from: off + m[1].length, to: markTo, type: "list", mark: true });
    const task = TASK.exec(text.slice(markTo));
    let contentFrom = markTo;
    /** @type {Range | null} */
    let checkbox = null;
    if (task) {
      checkbox = { from: markTo, to: markTo + 3 };
      pushToken(tokens, { from: markTo, to: markTo + 3, type: "list" });
      contentFrom = markTo + task[0].length;
    }
    inline(text, contentFrom, text.length, null, spans, tokens);
    return result(
      { kind: "list", ordered: /\d/.test(m[2]), task: task ? task[1] !== " " : null, mark: { from: off + m[1].length, to: markTo }, checkbox, indent: m[1].length + quoteMarks.length * 2 },
      "paragraph",
    );
  }
  if (rest.includes("|")) {
    const next = peek(1);
    const delimiter = TABLE_DELIMITER.test(rest);
    const header = !table && next !== null && TABLE_DELIMITER.test(next.replace(QUOTE, ""));
    if (table || header) {
      const cells = cellsOf(text, off);
      if (header) state.table = { columns: cells.length };
      const row = header ? "header" : delimiter && table ? "delimiter" : "body";
      let pipeAt = text.indexOf("|", off);
      while (pipeAt !== -1) {
        if (text[pipeAt - 1] !== "\\") pushToken(tokens, { from: pipeAt, to: pipeAt + 1, type: "table", mark: true });
        pipeAt = text.indexOf("|", pipeAt + 1);
      }
      if (row === "delimiter") pushToken(tokens, { from: off, to: text.length, type: "table", mark: true });
      else for (const c of cells) inline(text, c.from, c.to, null, spans, tokens);
      return result({ kind: "table", row, cells }, "other");
    }
  }
  state.table = null;
  inline(text, off, text.length, null, spans, tokens);
  return result({ kind: "paragraph" }, "paragraph");
};

/** @type {ModeSpec} */
export const markdownSpec = {
  name: "markdown",
  lookAhead: 1,
  startState: () => ({ fence: null, table: null, prev: "blank" }),
  indentAfter: () => 0,
  line,
};

export default defineMode(markdownSpec);
