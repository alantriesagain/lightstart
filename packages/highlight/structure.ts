/**
 * @file The shape of a Markdown line's structure: its block, quote and inline
 * spans, and the ranges inside them. Kept apart from the Markdown tokenizer so
 * a caller can name the shape without loading the grammar.
 */
import type { Token } from "./state.ts";

/** The language of the line after this one, or null for none. */
export type Peek = (offset: number) => string | null;

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
