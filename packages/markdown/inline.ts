/**
 * @file The inline phase: a line of Markdown to inline nodes, with CommonMark's delimiter-run
 * algorithm for `*` and `_`, code spans in backtick runs of any length, backslash escapes, links,
 * images and their references, `<scheme:...>` and `<email>` autolinks before inline HTML, wiki
 * links, `~~del~~` and hard and soft breaks. Character references stay as written; a URL is not
 * decoded here.
 */
import {
  CodeSpan,
  Del,
  Em,
  HardBreak,
  Image,
  Inline,
  InlineHtml,
  Link,
  MAX_NESTING,
  SoftBreak,
  Strong,
  Text,
  WikiLink,
} from "./nodes.ts";

/** A link reference definition's target and title, collected document-wide. */
export class LinkDefinition {
  href: string;
  title: string;

  constructor(href: string, title: string) {
    this.href = href;
    this.title = title;
  }
}

/** A delimiter run waiting for its pair while emphasis is resolved. */
class Delimiter extends Inline {
  char: string;
  count: number;
  canOpen: boolean;
  canClose: boolean;

  constructor(char: string, count: number, canOpen: boolean, canClose: boolean) {
    super();
    this.char = char;
    this.count = count;
    this.canOpen = canOpen;
    this.canClose = canClose;
  }
}

/** What a link's tail (`(dest "title")`, `[label]` or a shortcut) answered. */
class LinkTail {
  href: string;
  title: string;
  end: number;

  constructor(href: string, title: string, end: number) {
    this.href = href;
    this.title = title;
    this.end = end;
  }
}

const PUNCTUATION = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/;
const WHITESPACE = /\s/;
const MAX_PARENS = 32;

const isPunctuation = (c: string): boolean => c.length > 0 && PUNCTUATION.test(c);
const isWhitespace = (c: string): boolean => c.length === 0 || WHITESPACE.test(c);

/** A reference label as it is looked up: trimmed, its runs of whitespace one space, lowercased. */
export const normalizeLabel = (label: string): string => label.trim().replace(/\s+/g, " ").toLowerCase();

/** The plain text of `inlines`: a break becomes a space, a link its text, an image its alt. */
export const plainText = (inlines: Inline[]): string => {
  let out = "";
  for (const node of inlines) {
    if (node instanceof Text) out += node.text;
    else if (node instanceof CodeSpan) out += node.text;
    else if (node instanceof Strong) out += plainText(node.children);
    else if (node instanceof Em) out += plainText(node.children);
    else if (node instanceof Del) out += plainText(node.children);
    else if (node instanceof Link) out += plainText(node.children);
    else if (node instanceof Image) out += node.alt;
    else if (node instanceof WikiLink) out += node.display;
    else if (node instanceof InlineHtml) out += node.text;
    else if (node instanceof HardBreak) out += " ";
    else if (node instanceof SoftBreak) out += " ";
  }
  return out;
};

/**
 * The closers of one inline run, found once instead of rescanned from every opener: the `]` that
 * matches each `[` (skipping escapes, code spans and nested brackets) and the next `]]` at or after
 * each position. An opener whose closer is missing is answered in constant time, so a run of
 * unmatched brackets stays linear.
 */
class Closers {
  brackets: number[];
  wiki: number[];

  constructor(text: string) {
    const n = text.length;
    this.brackets = [];
    this.wiki = [];
    for (let k = 0; k < n; k++) this.brackets.push(-1);
    const bracketStack: number[] = [];
    let i = 0;
    while (i < n) {
      const c = text.charAt(i);
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        let m = 1;
        while (text.charAt(i + m) === "`") m++;
        const close = closingBackticks(text, i + m, m);
        i = close >= 0 ? close + m : i + m;
        continue;
      }
      if (c === "[") bracketStack.push(i);
      else if (c === "]") {
        if (bracketStack.length > 0) {
          const open = bracketStack.pop() as number;
          this.brackets[open] = i;
        }
      }
      i++;
    }
    for (let k = 0; k <= n; k++) this.wiki.push(-1);
    for (let k = n - 1; k >= 0; k--) {
      if (text.charAt(k) === "]" && text.charAt(k + 1) === "]") this.wiki[k] = k;
      else this.wiki[k] = this.wiki[k + 1];
    }
  }
}

/** The tail after a link's `]`: an inline destination and title, a reference, or a shortcut; null when none. */
const linkTail = (text: string, at: number, label: string, defs: Map<string, LinkDefinition>): LinkTail | null => {
  if (text.charAt(at) === "(") {
    let i = at + 1;
    while (i < text.length && isWhitespace(text.charAt(i))) i++;
    let href = "";
    if (text.charAt(i) === "<") {
      i++;
      const start = i;
      // An angle destination holds no `<` and no line break, so a missing `>` ends the scan there.
      while (i < text.length && text.charAt(i) !== ">" && text.charAt(i) !== "<" && text.charAt(i) !== "\n") {
        if (text.charAt(i) === "\\") i++;
        i++;
      }
      if (text.charAt(i) !== ">") return null;
      href = text.slice(start, i);
      i++;
    } else {
      const start = i;
      let depth = 0;
      while (i < text.length) {
        const c = text.charAt(i);
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === "(") {
          // cmark's cap on nested parentheses in a destination, which also ends the scan of a run
          // of unclosed ones.
          if (depth === MAX_PARENS) return null;
          depth++;
          i++;
          continue;
        }
        if (c === ")") {
          if (depth === 0) break;
          depth--;
          i++;
          continue;
        }
        if (isWhitespace(c)) break;
        i++;
      }
      href = text.slice(start, i);
    }
    while (i < text.length && isWhitespace(text.charAt(i))) i++;
    let title = "";
    const q = text.charAt(i);
    if (q === '"' || q === "'" || q === "(") {
      const close = q === "(" ? ")" : q;
      i++;
      const start = i;
      // A title in parentheses holds no unescaped `(`, so the scan stops at one.
      while (i < text.length && text.charAt(i) !== close && !(q === "(" && text.charAt(i) === "(")) {
        if (text.charAt(i) === "\\") i++;
        i++;
      }
      if (text.charAt(i) !== close) return null;
      title = text.slice(start, i);
      i++;
      while (i < text.length && isWhitespace(text.charAt(i))) i++;
    }
    if (text.charAt(i) !== ")") return null;
    return new LinkTail(href, title, i + 1);
  }
  if (text.charAt(at) === "[") {
    const close = text.indexOf("]", at + 1);
    if (close < 0) return null;
    const refLabel = text.slice(at + 1, close);
    const def = defs.get(normalizeLabel(refLabel.length > 0 ? refLabel : label));
    if (def === undefined) return null;
    return new LinkTail(def.href, def.title, close + 1);
  }
  const def = defs.get(normalizeLabel(label));
  if (def === undefined) return null;
  return new LinkTail(def.href, def.title, at);
};

/** The index of the closing backtick run of exactly `n` at or after `from`, or -1. */
const closingBackticks = (text: string, from: number, n: number): number => {
  let i = from;
  while (i < text.length) {
    if (text.charAt(i) === "`") {
      let m = 1;
      while (text.charAt(i + m) === "`") m++;
      if (m === n) return i;
      i += m;
    } else i++;
  }
  return -1;
};

/** Turn unresolved delimiter runs into the text they would render as. */
const literalize = (nodes: Inline[]): Inline[] => {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node instanceof Delimiter) out.push(new Text(node.char.repeat(node.count)));
    else out.push(node);
  }
  return out;
};

/** Resolve every delimiter run against the ones before it, wrapping what stands between a pair. */
const resolveDelimiters = (nodes: Inline[], depth: number = 0): Inline[] => {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node instanceof Delimiter && node.canClose) {
      while (node.count > 0 && node.canClose) {
        let at = -1;
        for (let k = out.length - 1; k >= 0; k--) {
          const opener = out[k];
          if (opener instanceof Delimiter && opener.char === node.char && opener.canOpen && opener.count > 0) {
            at = k;
            break;
          }
        }
        if (at < 0) break;
        const opener = out[at] as Delimiter;
        let use = 1;
        if (node.char === "~") use = 2;
        else if (opener.count >= 2 && node.count >= 2) use = 2;
        if (use > opener.count) use = opener.count;
        if (use > node.count) use = node.count;
        const between = out.splice(at + 1);
        const children = depth < MAX_NESTING ? resolveDelimiters(between, depth + 1) : literalize(between);
        let wrapper: Inline;
        if (node.char === "~") wrapper = new Del(children);
        else if (use >= 2) wrapper = new Strong(children);
        else wrapper = new Em(children);
        opener.count -= use;
        node.count -= use;
        if (opener.count === 0) out.pop();
        out.push(wrapper);
      }
      if (node.count > 0) out.push(node);
    } else out.push(node);
  }
  return literalize(out);
};

/** `text` as inline nodes; reference links resolve through `defs`. `depth` bounds nested link text. */
export const parseInline = (text: string, defs: Map<string, LinkDefinition> = new Map<string, LinkDefinition>(), depth: number = 0): Inline[] => {
  const out: Inline[] = [];
  const closers = new Closers(text);
  let buf = "";
  let i = 0;
  const flush = (): void => {
    if (buf.length > 0) {
      out.push(new Text(buf));
      buf = "";
    }
  };
  while (i < text.length) {
    const c = text.charAt(i);
    if (c === "\\") {
      const next = text.charAt(i + 1);
      if (next === "\n") {
        flush();
        out.push(new HardBreak());
        i += 2;
        continue;
      }
      if (next.length > 0 && isPunctuation(next)) {
        buf += next;
        i += 2;
        continue;
      }
      buf += "\\";
      i++;
      continue;
    }
    if (c === "\n") {
      let hard = false;
      if (/ {2,}$/.test(buf)) hard = true;
      buf = buf.replace(/ +$/, "");
      flush();
      out.push(hard ? new HardBreak() : new SoftBreak());
      i++;
      continue;
    }
    if (c === "`") {
      let n = 1;
      while (text.charAt(i + n) === "`") n++;
      const close = closingBackticks(text, i + n, n);
      if (close >= 0) {
        flush();
        let code = text.slice(i + n, close).replace(/\n/g, " ");
        if (code.length >= 2 && code.startsWith(" ") && code.endsWith(" ") && !/^ +$/.test(code)) code = code.slice(1, -1);
        out.push(new CodeSpan(code));
        i = close + n;
        continue;
      }
      buf += "`".repeat(n);
      i += n;
      continue;
    }
    if (c === "[" && text.charAt(i + 1) === "[") {
      const close = closers.wiki[i + 2];
      if (close >= 0) {
        const inner = text.slice(i + 2, close);
        const bar = inner.indexOf("|");
        const name = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
        const display = (bar >= 0 ? inner.slice(bar + 1) : inner).trim();
        flush();
        out.push(new WikiLink(name, display));
        i = close + 2;
        continue;
      }
    }
    if (depth < MAX_NESTING && c === "!" && text.charAt(i + 1) === "[") {
      const close = closers.brackets[i + 1];
      if (close >= 0) {
        const label = text.slice(i + 2, close);
        const tail = linkTail(text, close + 1, label, defs);
        if (tail !== null) {
          flush();
          out.push(new Image(tail.href, tail.title, plainText(parseInline(label, defs, depth + 1))));
          i = tail.end;
          continue;
        }
      }
      buf += "!";
      i++;
      continue;
    }
    if (depth < MAX_NESTING && c === "[") {
      const close = closers.brackets[i];
      if (close >= 0) {
        const label = text.slice(i + 1, close);
        const tail = linkTail(text, close + 1, label, defs);
        if (tail !== null) {
          flush();
          out.push(new Link(tail.href, tail.title, parseInline(label, defs, depth + 1)));
          i = tail.end;
          continue;
        }
      }
      buf += "[";
      i++;
      continue;
    }
    if (c === "<") {
      const rest = text.slice(i);
      const auto = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>/.exec(rest);
      if (auto !== null) {
        flush();
        out.push(new Link(auto[1], "", [new Text(auto[1])]));
        i += auto[0].length;
        continue;
      }
      const email = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/.exec(rest);
      if (email !== null) {
        flush();
        out.push(new Link("mailto:" + email[1], "", [new Text(email[1])]));
        i += email[0].length;
        continue;
      }
      const comment = /^<!--[\s\S]*?-->/.exec(rest);
      if (comment !== null) {
        flush();
        out.push(new InlineHtml(comment[0]));
        i += comment[0].length;
        continue;
      }
      const tag = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/.exec(rest);
      if (tag !== null) {
        flush();
        out.push(new InlineHtml(tag[0]));
        i += tag[0].length;
        continue;
      }
    }
    if (c === "*" || c === "_" || c === "~") {
      let n = 1;
      while (text.charAt(i + n) === c) n++;
      if (c === "~" && n !== 2) {
        buf += "~".repeat(n);
        i += n;
        continue;
      }
      const prev = i > 0 ? text.charAt(i - 1) : "";
      const next = i + n < text.length ? text.charAt(i + n) : "";
      const left = next.length > 0 && !isWhitespace(next) && (!isPunctuation(next) || isWhitespace(prev) || isPunctuation(prev));
      const right = prev.length > 0 && !isWhitespace(prev) && (!isPunctuation(prev) || isWhitespace(next) || isPunctuation(next));
      let canOpen = left;
      let canClose = right;
      if (c === "_") {
        canOpen = left && (!right || isPunctuation(prev));
        canClose = right && (!left || isPunctuation(next));
      }
      if (!canOpen && !canClose) {
        buf += c.repeat(n);
        i += n;
        continue;
      }
      flush();
      out.push(new Delimiter(c, n, canOpen, canClose));
      i += n;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return resolveDelimiters(out);
};
