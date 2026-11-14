/**
 * @file Markdown, a line at a time: a block's kind and marks (headings, rules, lists, quotes, code
 * fences, tables) and the inline spans of what follows (code spans, strong and emphasis,
 * strikethrough, links, images, wiki links, bare URLs, HTML tags, escapes), as tokens plus the
 * structure a live preview needs. Fenced code is colored in the fence's registered language with a
 * state of its own; front matter at the top reads as keys and values. Underscores inside a word
 * (snake_case) are not emphasis. A table is recognized from the delimiter row below its header, so a
 * line may look at the next one through `peek`.
 */
import { languageForFence } from "./registry.ts";
import { FenceState, HlState, pushToken, TableState, Token } from "./state.ts";

const FRONT = /^(---|\.\.\.)\s*$/;
const FRONT_KEY = /^(\s*[\w.-]+)(:)/;
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

/** The language of the line after this one, or null for none. */
export type Peek = (offset: number) => string | null;

/** A span of a line: the token type a Markdown span takes. */
const SPAN_TYPES = new Map<string, string>([
  ["code", "code"],
  ["emphasis", "emphasis"],
  ["strong", "strong"],
  ["strikethrough", "strikethrough"],
  ["link", "link"],
  ["image", "link"],
  ["wiki", "link"],
  ["autolink", "url"],
  ["tag", "meta"],
  ["escape", "escape"],
  ["html", "tag"],
]);

/** A range of columns within a line. */
export class Range {
  from: number;
  to: number;

  constructor(from: number, to: number) {
    this.from = from;
    this.to = to;
  }
}

/** A block of a Markdown line, with the fields its `kind` uses. */
export class MdBlock {
  kind: string;
  level = 0;
  mark: Range | null = null;
  edge: string | null = null;
  lang = "";
  ordered = false;
  task: boolean | null = null;
  checkbox: Range | null = null;
  indent = 0;
  row = "";
  cells: Range[] = [];

  constructor(kind: string) {
    this.kind = kind;
  }
}

/** An inline span of a Markdown line, with its marks and any target or name. */
export class MdSpan {
  type: string;
  from: number;
  to: number;
  open: Range | null;
  close: Range | null;
  url = "";
  name = "";
  display = "";

  constructor(type: string, from: number, to: number, open: Range | null, close: Range | null) {
    this.type = type;
    this.from = from;
    this.to = to;
    this.open = open;
    this.close = close;
  }
}

/** A line's quote depth and the ranges of its quote marks. */
export class MdQuote {
  depth: number;
  marks: Range[];

  constructor(depth: number, marks: Range[]) {
    this.depth = depth;
    this.marks = marks;
  }
}

/** One Markdown line's block, quote and inline spans. */
export class MdLine {
  block: MdBlock;
  quote: MdQuote;
  spans: MdSpan[];

  constructor(block: MdBlock, quote: MdQuote, spans: MdSpan[]) {
    this.block = block;
    this.quote = quote;
    this.spans = spans;
  }
}

/** A Markdown line's tokens and its structure, `md` null for another language. */
export class LineResult {
  tokens: Token[];
  md: MdLine | null;

  constructor(tokens: Token[], md: MdLine | null) {
    this.tokens = tokens;
    this.md = md;
  }
}

class Delim {
  ch: string;
  pos: number;
  len: number;
  origLen: number;
  canOpen: boolean;
  canClose: boolean;

  constructor(ch: string, pos: number, len: number, canOpen: boolean, canClose: boolean) {
    this.ch = ch;
    this.pos = pos;
    this.len = len;
    this.origLen = len;
    this.canOpen = canOpen;
    this.canClose = canClose;
  }
}

class Flank {
  open: boolean;
  close: boolean;

  constructor(open: boolean, close: boolean) {
    this.open = open;
    this.close = close;
  }
}

const isSpace = (text: string, i: number): boolean => i < 0 || i >= text.length || /\s/.test(text.charAt(i));

const isWordChar = (text: string, i: number): boolean => i >= 0 && i < text.length && /[\p{L}\p{N}_]/u.test(text.charAt(i));

const flanking = (text: string, i: number, len: number, ch: string): Flank => {
  const before = i - 1;
  const after = i + len;
  const beforeCh = text.charAt(before);
  const afterCh = text.charAt(after);
  const left = !isSpace(text, after) && (!PUNCT.test(afterCh) || isSpace(text, before) || PUNCT.test(beforeCh));
  const right = !isSpace(text, before) && (!PUNCT.test(beforeCh) || isSpace(text, after) || PUNCT.test(afterCh));
  if (ch === "_") return new Flank(left && (!right || PUNCT.test(beforeCh)) && !isWordChar(text, before), right && (!left || PUNCT.test(afterCh)) && !isWordChar(text, after));
  return new Flank(left, right);
};

/** CommonMark's delimiter run processing: every closer pairs with the nearest matching opener, the rule of three keeps `**a *b* c**` honest. */
const processEmphasis = (delims: Delim[], spans: MdSpan[]): void => {
  for (let ci = 0; ci < delims.length; ci++) {
    const closer = delims[ci];
    if (!closer.canClose || closer.len === 0) continue;
    let oi = ci - 1;
    while (oi >= 0) {
      const opener = delims[oi];
      const oddMatch = (opener.canClose || closer.canOpen) && (opener.origLen + closer.origLen) % 3 === 0 && !(opener.origLen % 3 === 0 && closer.origLen % 3 === 0);
      if (opener.len > 0 && opener.canOpen && opener.ch === closer.ch && !(closer.ch !== "~" && oddMatch)) break;
      oi--;
    }
    if (oi < 0) continue;
    const opener = delims[oi];
    if (closer.ch === "~" && (opener.len < 2 || closer.len < 2)) continue;
    const width = closer.ch === "~" ? 2 : opener.len >= 2 && closer.len >= 2 ? 2 : 1;
    const openFrom = opener.pos + opener.len - width;
    const closeFrom = closer.pos;
    const type = closer.ch === "~" ? "strikethrough" : width === 2 ? "strong" : "emphasis";
    spans.push(new MdSpan(type, openFrom, closeFrom + width, new Range(openFrom, openFrom + width), new Range(closeFrom, closeFrom + width)));
    opener.len -= width;
    closer.len -= width;
    closer.pos += width;
    for (let k = oi + 1; k < ci; k++) delims[k].len = 0;
    if (closer.len > 0) ci--;
  }
};

const scanInline = (text: string, from: number, to: number, spans: MdSpan[]): void => {
  const delims: Delim[] = [];
  let i = from;
  const emit = (span: MdSpan, contentFrom: number, contentTo: number): void => {
    spans.push(span);
    if (contentTo > contentFrom) scanInline(text, contentFrom, contentTo, spans);
  };
  while (i < to) {
    const ch = text.charAt(i);
    if (ch === "\\" && i + 1 < to && PUNCT.test(text.charAt(i + 1))) {
      spans.push(new MdSpan("escape", i, i + 2, null, null));
      i += 2;
      continue;
    }
    if (ch === "`") {
      let n = 0;
      while (i + n < to && text.charAt(i + n) === "`") n++;
      let end = text.indexOf("`".repeat(n), i + n);
      while (end !== -1 && end + n <= to && text.charAt(end + n) === "`") end = text.indexOf("`".repeat(n), end + n + 1);
      if (end !== -1 && end + n <= to) {
        spans.push(new MdSpan("code", i, end + n, new Range(i, i + n), new Range(end, end + n)));
        i = end + n;
        continue;
      }
      i += n;
      continue;
    }
    if (ch === "*" || ch === "_" || ch === "~") {
      let n = 0;
      while (i + n < to && text.charAt(i + n) === ch) n++;
      if (ch === "~") {
        if (n >= 2) delims.push(new Delim(ch, i, n, !isSpace(text, i + n), !isSpace(text, i - 1)));
      } else {
        const can = flanking(text, i, n, ch);
        delims.push(new Delim(ch, i, n, can.open, can.close));
      }
      i += n;
      continue;
    }
    if (ch === "!" && text.charAt(i + 1) === "[") {
      const m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(text.slice(i, to));
      if (m !== null) {
        const span = new MdSpan("image", i, i + m[0].length, new Range(i, i + 2), new Range(i + 2 + m[1].length, i + m[0].length));
        span.url = m[2];
        spans.push(span);
        i += m[0].length;
        continue;
      }
    }
    if (ch === "[") {
      const wiki = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(text.slice(i, to));
      if (wiki !== null) {
        const name = wiki[1].trim();
        const display = (wiki[2] !== undefined ? wiki[2] : wiki[1]).trim();
        const span = new MdSpan("wiki", i, i + wiki[0].length, new Range(i, i + 2), new Range(i + wiki[0].length - 2, i + wiki[0].length));
        span.name = name;
        span.display = display;
        spans.push(span);
        i += wiki[0].length;
        continue;
      }
      const link = /^\[((?:[^\]\\]|\\.)*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(text.slice(i, to));
      if (link !== null) {
        const textTo = i + 1 + link[1].length;
        const span = new MdSpan("link", i, i + link[0].length, new Range(i, i + 1), new Range(textTo, i + link[0].length));
        span.url = link[2];
        emit(span, i + 1, textTo);
        i += link[0].length;
        continue;
      }
    }
    if (ch === "<") {
      const auto = /^<((?:https?|mailto):[^>\s]+)>/.exec(text.slice(i, to));
      if (auto !== null) {
        const span = new MdSpan("autolink", i, i + auto[0].length, new Range(i, i + 1), new Range(i + auto[0].length - 1, i + auto[0].length));
        span.url = auto[1];
        spans.push(span);
        i += auto[0].length;
        continue;
      }
      const html = /^<\/?[a-zA-Z][^>]*>/.exec(text.slice(i, to));
      if (html !== null) {
        spans.push(new MdSpan("html", i, i + html[0].length, null, null));
        i += html[0].length;
        continue;
      }
    }
    if (ch === "h" && (text.startsWith("http://", i) || text.startsWith("https://", i))) {
      const m = /^https?:\/\/[^\s<>)]+/.exec(text.slice(i, to));
      if (m !== null) {
        const span = new MdSpan("autolink", i, i + m[0].length, null, null);
        span.url = m[0];
        spans.push(span);
        i += m[0].length;
        continue;
      }
    }
    if (ch === "#" && isSpace(text, i - 1)) {
      const m = /^#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/u.exec(text.slice(i, to));
      if (m !== null) {
        const span = new MdSpan("tag", i, i + m[0].length, null, null);
        span.name = m[1];
        spans.push(span);
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  processEmphasis(delims, spans);
};

const inline = (text: string, from: number, to: number, base: string | null, spans: MdSpan[], tokens: Token[]): void => {
  const start = spans.length;
  scanInline(text, from, to, spans);
  const local = spans.slice(start);
  local.sort((a: MdSpan, b: MdSpan): number => a.from - b.from || b.to - a.to);
  const types: (string | null)[] = [];
  const isMark: boolean[] = [];
  for (let k = 0; k < to - from; k++) {
    types.push(base);
    isMark.push(false);
  }
  const fill = (r: Range | null, type: string, mark: boolean): void => {
    if (r === null) return;
    for (let k = r.from; k < r.to; k++) {
      types[k - from] = type;
      isMark[k - from] = mark;
    }
  };
  for (const s of local) {
    const type = SPAN_TYPES.get(s.type);
    if (type === undefined) continue;
    fill(new Range(s.from, s.to), type, s.type === "escape");
    fill(s.open, type, true);
    fill(s.close, type, true);
    if ((s.type === "link" || s.type === "image") && s.close !== null) {
      const urlFrom = s.close.from + 2;
      const urlTo = s.url.length > 0 ? urlFrom + s.url.length : urlFrom;
      fill(new Range(urlFrom, urlTo), "url", true);
    }
  }
  for (let i = 0; i < types.length; ) {
    const type = types[i];
    const mark = isMark[i];
    let j = i + 1;
    while (j < types.length && types[j] === type && isMark[j] === mark) j++;
    if (type !== null) pushToken(tokens, from + i, from + j, type, mark);
    i = j;
  }
};

const cellsOf = (text: string, off: number): Range[] => {
  const cells: Range[] = [];
  let start = off;
  let i = off;
  const trimmed = text.trimEnd();
  const end = trimmed.length;
  const leading = /^\s*\|/.exec(text.slice(off));
  if (leading !== null) {
    i = off + leading[0].length;
    start = i;
  }
  const closes = /\|\s*$/.test(text);
  const last = closes ? trimmed.lastIndexOf("|") : end;
  while (i < last) {
    if (text.charAt(i) === "\\") {
      i += 2;
      continue;
    }
    if (text.charAt(i) === "|") {
      cells.push(new Range(start, i));
      i++;
      start = i;
      continue;
    }
    i++;
  }
  if (last >= start) cells.push(new Range(start, last));
  return cells;
};

/**
 * One Markdown line's tokens and structure, advancing `state` (front matter in `mode`, an open fence
 * in `fence`, a table in `table`, the previous block in `prev`). `codeLine` tokenizes a fenced line
 * in its registered language; `peek` answers the line `offset` after this one.
 */
export const markdownLine = (text: string, state: HlState, codeLine: (language: string, text: string, state: HlState, peek: Peek) => Token[], peek: Peek): LineResult => {
  const tokens: Token[] = [];
  const spans: MdSpan[] = [];
  const quoteMarks: Range[] = [];
  let off = 0;
  const fence = state.fence;
  const result = (block: MdBlock, prev: string): LineResult => {
    state.prev = prev;
    return new LineResult(tokens, new MdLine(block, new MdQuote(quoteMarks.length, quoteMarks), spans));
  };
  const eatQuotes = (max: number): void => {
    while (quoteMarks.length < max) {
      const m = QUOTE.exec(text.slice(off));
      if (m === null) break;
      quoteMarks.push(new Range(off, off + m[0].length));
      pushToken(tokens, off, off + m[0].length, "quote", true);
      off += m[0].length;
    }
  };
  const first = state.mode === "start";
  if (first) state.mode = "";
  if (state.mode === "front" || (first && FRONT.test(text) && text.startsWith("---"))) {
    if (state.mode === "front" && FRONT.test(text)) state.mode = "";
    else if (first) state.mode = "front";
    else {
      const key = FRONT_KEY.exec(text);
      if (key !== null) {
        pushToken(tokens, 0, key[1].length, "property");
        pushToken(tokens, key[1].length + 1, text.length, "string");
      }
      return result(new MdBlock("paragraph"), "other");
    }
    pushToken(tokens, 0, text.length, "meta");
    return result(new MdBlock("paragraph"), "other");
  }
  if (fence !== null) {
    eatQuotes(fence.quote);
    const rest = text.slice(off);
    const close = new RegExp("^ {0,3}\\" + fence.marker + "{" + String(fence.len) + ",}\\s*$").exec(rest);
    if (close !== null) {
      pushToken(tokens, off, text.length, "code", true);
      state.fence = null;
      const block = new MdBlock("fence");
      block.edge = "close";
      block.lang = fence.lang;
      return result(block, "other");
    }
    if (fence.inner !== null && fence.name.length > 0) {
      const innerTokens = codeLine(fence.name, text.slice(off), fence.inner, peek);
      for (const t of innerTokens) pushToken(tokens, t.from + off, t.to + off, t.type, t.mark);
    } else if (text.length > off) pushToken(tokens, off, text.length, "code");
    const openBlock = new MdBlock("fence");
    openBlock.lang = fence.lang;
    return result(openBlock, "other");
  }
  if (/^\s*$/.test(text)) {
    state.table = null;
    return result(new MdBlock("blank"), "blank");
  }
  eatQuotes(Number.MAX_SAFE_INTEGER);
  const rest = text.slice(off);
  const table = state.table;
  if (quoteMarks.length === 0 && /^(?: {4}|\t)/.test(rest) && state.prev !== "paragraph") {
    state.table = null;
    pushToken(tokens, off, text.length, "code");
    return result(new MdBlock("code"), "other");
  }
  let m = FENCE_OPEN.exec(rest);
  if (m !== null) {
    state.table = null;
    const lang = m[2];
    const name = languageForFence(lang);
    pushToken(tokens, off, off + m[0].length - lang.length, "code", true);
    if (lang.length > 0) pushToken(tokens, off + m[0].length - lang.length, off + m[0].length, "meta");
    state.fence = new FenceState(m[1].charAt(0), m[1].length, lang, name, name.length > 0 ? new HlState() : null, quoteMarks.length);
    const block = new MdBlock("fence");
    block.edge = "open";
    block.lang = lang;
    return result(block, "other");
  }
  m = ATX.exec(rest);
  if (m !== null) {
    state.table = null;
    const level = m[1].length;
    const markTo = off + m[0].length;
    pushToken(tokens, off, markTo, "heading", true);
    const closeMark = ATX_CLOSE.exec(rest);
    const contentTo = closeMark !== null ? off + closeMark.index : text.length;
    inline(text, markTo, Math.max(markTo, contentTo), "heading", spans, tokens);
    if (closeMark !== null) pushToken(tokens, contentTo, text.length, "heading", true);
    const block = new MdBlock("heading");
    block.level = level;
    block.mark = new Range(off, markTo);
    return result(block, "other");
  }
  if (state.prev === "paragraph" && table === null && SETEXT.test(rest)) {
    pushToken(tokens, off, text.length, "heading", true);
    const block = new MdBlock("setext");
    block.level = rest.trim().charAt(0) === "=" ? 1 : 2;
    return result(block, "other");
  }
  if (HR.test(rest)) {
    state.table = null;
    pushToken(tokens, off, text.length, "hr", true);
    return result(new MdBlock("hr"), "other");
  }
  m = LIST.exec(rest);
  if (m !== null) {
    state.table = null;
    const markTo = off + m[0].length;
    pushToken(tokens, off + m[1].length, markTo, "list", true);
    const task = TASK.exec(text.slice(markTo));
    let contentFrom = markTo;
    let checkbox: Range | null = null;
    if (task !== null) {
      checkbox = new Range(markTo, markTo + 3);
      pushToken(tokens, markTo, markTo + 3, "list");
      contentFrom = markTo + task[0].length;
    }
    inline(text, contentFrom, text.length, null, spans, tokens);
    const block = new MdBlock("list");
    block.ordered = /\d/.test(m[2]);
    block.task = task !== null ? task[1] !== " " : null;
    block.mark = new Range(off + m[1].length, markTo);
    block.checkbox = checkbox;
    block.indent = m[1].length + quoteMarks.length * 2;
    return result(block, "paragraph");
  }
  if (rest.includes("|")) {
    const next = peek(1);
    const delimiter = TABLE_DELIMITER.test(rest);
    const header = table === null && next !== null && TABLE_DELIMITER.test(next.replace(QUOTE, ""));
    if (table !== null || header) {
      const cells = cellsOf(text, off);
      if (header) state.table = new TableState(cells.length);
      const row = header ? "header" : delimiter && table !== null ? "delimiter" : "body";
      let pipeAt = text.indexOf("|", off);
      while (pipeAt !== -1) {
        if (text.charAt(pipeAt - 1) !== "\\") pushToken(tokens, pipeAt, pipeAt + 1, "table", true);
        pipeAt = text.indexOf("|", pipeAt + 1);
      }
      if (row === "delimiter") pushToken(tokens, off, text.length, "table", true);
      else for (const c of cells) inline(text, c.from, c.to, null, spans, tokens);
      const block = new MdBlock("table");
      block.row = row;
      block.cells = cells;
      return result(block, "other");
    }
  }
  state.table = null;
  inline(text, off, text.length, null, spans, tokens);
  return result(new MdBlock("paragraph"), "paragraph");
};
