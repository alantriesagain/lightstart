/**
 * @file The tokenizers' state between lines: one class for every language (natively a subclass would
 * lose its identity through a base-typed parameter), each mode using its own fields. HTML holds the
 * state of the JavaScript or CSS inside a <script> or <style> as `inner`.
 */

export class Frame {
  /** "tpl" inside a template literal's text, "expr" inside its ${…}. */
  kind: string;
  braces = 0;

  constructor(kind: string) {
    this.kind = kind;
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
    return c;
  }
}

export class Token {
  from: number;
  to: number;
  type: string;

  constructor(from: number, to: number, type: string) {
    this.from = from;
    this.to = to;
    this.type = type;
  }
}

/** Append a token, joining it to the last one when they touch and share a type. */
export const pushToken = (tokens: Token[], from: number, to: number, type: string): void => {
  if (to <= from) return;
  const last = tokens.length > 0 ? tokens[tokens.length - 1] : null;
  if (last !== null && last.to === from && last.type === type) last.to = to;
  else tokens.push(new Token(from, to, type));
};
