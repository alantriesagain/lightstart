/**
 * @file The tokenizers' state between lines: one class for every language (natively a subclass would
 * lose its identity through a base-typed parameter), each mode using its own fields. HTML holds the
 * state of the JavaScript or CSS inside a <script> or <style> as `inner`; Markdown holds an open
 * fence's marker, language and inner state in `fence` and a recognized table's column count in
 * `table`.
 */

export class Frame {
  /** "tpl" inside a template literal's text, "expr" inside its ${…}. */
  kind: string;
  braces = 0;

  constructor(kind: string) {
    this.kind = kind;
  }
}

/** An open Markdown fence: its marker character and run length, its info language and name, and the state of its code. */
export class FenceState {
  marker: string;
  len: number;
  lang: string;
  name: string;
  inner: HlState | null;
  quote: number;

  constructor(marker: string, len: number, lang: string, name: string, inner: HlState | null, quote: number) {
    this.marker = marker;
    this.len = len;
    this.lang = lang;
    this.name = name;
    this.inner = inner;
    this.quote = quote;
  }

  clone(): FenceState {
    const inner = this.inner;
    return new FenceState(this.marker, this.len, this.lang, this.name, inner !== null ? inner.clone() : null, this.quote);
  }

  equals(other: FenceState): boolean {
    if (this.marker !== other.marker || this.len !== other.len || this.lang !== other.lang || this.name !== other.name || this.quote !== other.quote) return false;
    const inner = this.inner;
    const otherInner = other.inner;
    if (inner === null || otherInner === null) return inner === otherInner;
    return inner.equals(otherInner);
  }
}

/** A recognized Markdown table, with the number of cells its header has. */
export class TableState {
  columns: number;

  constructor(columns: number) {
    this.columns = columns;
  }
}

export class HlState {
  stack: Frame[] = [];
  comment = false;
  /** The quote of a string continued on the next line, "" for none. */
  string = "";
  regexOk = true;
  decl = false;
  afterDot = false;
  objKey = false;
  depth = 0;
  mode = "start";
  url = false;
  hmode = 0;
  quote = "";
  tagName = "";
  closing = false;
  nameNext = false;
  afterEq = false;
  attrName = "";
  /** A <script>'s type attribute; `hasScriptType` false when it has none. */
  scriptType = "";
  hasScriptType = false;
  rawTag = "";
  /** "javascript", "css", or "" for a <script> of another type (not colored). */
  rawLang = "";
  inner: HlState | null = null;
  /** Markdown's open fence, null for none. */
  fence: FenceState | null = null;
  /** Markdown's recognized table, null for none. */
  table: TableState | null = null;
  /** Markdown's previous block kind ("blank", "paragraph" or "other"). */
  prev = "blank";

  clone(): HlState {
    const c = new HlState();
    for (const f of this.stack) {
      const g = new Frame(f.kind);
      g.braces = f.braces;
      c.stack.push(g);
    }
    c.comment = this.comment;
    c.string = this.string;
    c.regexOk = this.regexOk;
    c.decl = this.decl;
    c.afterDot = this.afterDot;
    c.objKey = this.objKey;
    c.depth = this.depth;
    c.mode = this.mode;
    c.url = this.url;
    c.hmode = this.hmode;
    c.quote = this.quote;
    c.tagName = this.tagName;
    c.closing = this.closing;
    c.nameNext = this.nameNext;
    c.afterEq = this.afterEq;
    c.attrName = this.attrName;
    c.scriptType = this.scriptType;
    c.hasScriptType = this.hasScriptType;
    c.rawTag = this.rawTag;
    c.rawLang = this.rawLang;
    const inner = this.inner;
    c.inner = inner !== null ? inner.clone() : null;
    const fence = this.fence;
    c.fence = fence !== null ? fence.clone() : null;
    const table = this.table;
    c.table = table !== null ? new TableState(table.columns) : null;
    c.prev = this.prev;
    return c;
  }

  /**
   * Whether `other` is the same state, field for field as `clone()` copies them: a line that ends in
   * the state it ended in before leaves every later line as it was, so re-tokenizing can stop there.
   */
  equals(other: HlState): boolean {
    if (this.stack.length !== other.stack.length) return false;
    for (let i = 0; i < this.stack.length; i++) {
      const a = this.stack[i];
      const b = other.stack[i];
      if (a.kind !== b.kind || a.braces !== b.braces) return false;
    }
    if (
      this.comment !== other.comment ||
      this.string !== other.string ||
      this.regexOk !== other.regexOk ||
      this.decl !== other.decl ||
      this.afterDot !== other.afterDot ||
      this.objKey !== other.objKey ||
      this.depth !== other.depth ||
      this.mode !== other.mode ||
      this.url !== other.url ||
      this.hmode !== other.hmode ||
      this.quote !== other.quote ||
      this.tagName !== other.tagName ||
      this.closing !== other.closing ||
      this.nameNext !== other.nameNext ||
      this.afterEq !== other.afterEq ||
      this.attrName !== other.attrName ||
      this.scriptType !== other.scriptType ||
      this.hasScriptType !== other.hasScriptType ||
      this.rawTag !== other.rawTag ||
      this.rawLang !== other.rawLang ||
      this.prev !== other.prev
    )
      return false;
    const inner = this.inner;
    const otherInner = other.inner;
    if (inner === null || otherInner === null) {
      if (inner !== otherInner) return false;
    } else if (!inner.equals(otherInner)) return false;
    const fence = this.fence;
    const otherFence = other.fence;
    if (fence === null || otherFence === null) {
      if (fence !== otherFence) return false;
    } else if (!fence.equals(otherFence)) return false;
    const table = this.table;
    const otherTable = other.table;
    if (table === null || otherTable === null) return table === otherTable;
    return table.columns === otherTable.columns;
  }
}

export class Token {
  from: number;
  to: number;
  type: string;
  mark: boolean;

  constructor(from: number, to: number, type: string, mark = false) {
    this.from = from;
    this.to = to;
    this.type = type;
    this.mark = mark;
  }
}

/** Append a token, joining it to the last one when they touch, share a type and neither is a mark. */
export const pushToken = (tokens: Token[], from: number, to: number, type: string, mark = false): void => {
  if (to <= from) return;
  const last = tokens.length > 0 ? tokens[tokens.length - 1] : null;
  if (last !== null && last.to === from && last.type === type && !last.mark && !mark) last.to = to;
  else tokens.push(new Token(from, to, type, mark));
};
