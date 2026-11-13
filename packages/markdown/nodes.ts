/**
 * @file The nodes a Markdown document parses into: blocks (a heading, a paragraph, a fenced code
 * block, a list and its items, a quote, a rule, a table, raw HTML) and inlines (text, its styles,
 * links, images, wiki links, breaks and raw inline HTML). Every node is a class, so a renderer
 * narrows one with `instanceof`; none of them draws anything.
 */

/** The cap on containers (quotes and list levels) and on inline nesting. */
export const MAX_NESTING = 100;

/** A block: what stands on its own between blank lines. */
export abstract class Block {
  /** Whether a blank line separated this block from the one before it in its container. */
  blankBefore = false;
}

/** An inline: what runs inside a block's text. */
export abstract class Inline {}

/** Plain text. */
export class Text extends Inline {
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }
}

/** Strong emphasis, `**text**` or `__text__`. */
export class Strong extends Inline {
  children: Inline[];

  constructor(children: Inline[]) {
    super();
    this.children = children;
  }
}

/** Emphasis, `*text*` or `_text_`. */
export class Em extends Inline {
  children: Inline[];

  constructor(children: Inline[]) {
    super();
    this.children = children;
  }
}

/** Strikethrough, `~~text~~`. */
export class Del extends Inline {
  children: Inline[];

  constructor(children: Inline[]) {
    super();
    this.children = children;
  }
}

/** A code span, in backtick runs of any length. */
export class CodeSpan extends Inline {
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }
}

/** A link: its target, an optional title and its text. */
export class Link extends Inline {
  href: string;
  title: string;
  children: Inline[];

  constructor(href: string, title: string, children: Inline[]) {
    super();
    this.href = href;
    this.title = title;
    this.children = children;
  }
}

/** An image: its source, an optional title and its alt text as plain text. */
export class Image extends Inline {
  href: string;
  title: string;
  alt: string;

  constructor(href: string, title: string, alt: string) {
    super();
    this.href = href;
    this.title = title;
    this.alt = alt;
  }
}

/** A line break that starts a new terminal line but stays in the same paragraph. */
export class SoftBreak extends Inline {}

/** A break two trailing spaces or a trailing backslash asked for. */
export class HardBreak extends Inline {}

/** A wiki link, `[[name]]` or `[[name|display]]`. */
export class WikiLink extends Inline {
  name: string;
  display: string;

  constructor(name: string, display: string) {
    super();
    this.name = name;
    this.display = display;
  }
}

/** Raw inline HTML, an open or close tag or a comment. */
export class InlineHtml extends Inline {
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }
}

/** An ATX heading; `text` is its plain text. */
export class Heading extends Block {
  level: number;
  children: Inline[];
  text: string;

  constructor(level: number, children: Inline[], text: string) {
    super();
    this.level = level;
    this.children = children;
    this.text = text;
  }
}

/** A paragraph. */
export class Paragraph extends Block {
  children: Inline[];

  constructor(children: Inline[]) {
    super();
    this.children = children;
  }
}

/** A fenced code block: the full info string and the lines between the fences. */
export class Code extends Block {
  info: string;
  text: string;

  constructor(info: string, text: string) {
    super();
    this.info = info;
    this.text = text;
  }
}

/** A list item: its blocks and whether it is a task, checked or not. */
export class ListItem {
  blocks: Block[];
  task: boolean;
  checked: boolean;

  constructor(blocks: Block[], task: boolean, checked: boolean) {
    this.blocks = blocks;
    this.task = task;
    this.checked = checked;
  }
}

/** An ordered or unordered list; `start` is the first item's number. */
export class List extends Block {
  ordered: boolean;
  start: number;
  items: ListItem[];

  constructor(ordered: boolean, start: number, items: ListItem[]) {
    super();
    this.ordered = ordered;
    this.start = start;
    this.items = items;
  }
}

/** A quote, holding blocks of its own. */
export class Quote extends Block {
  blocks: Block[];

  constructor(blocks: Block[]) {
    super();
    this.blocks = blocks;
  }
}

/** A thematic break. */
export class Rule extends Block {}

/** A raw HTML block, its lines joined with newlines. */
export class Html extends Block {
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }
}
