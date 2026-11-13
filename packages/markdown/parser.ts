/**
 * @file The block phase: text to blocks with a container stack of quotes and list items, paragraphs
 * that continue lazily across lines, GFM pipe tables, fences, rules, headings, raw HTML blocks and
 * link reference definitions collected document-wide. It then parses each block's text with the
 * inline phase (`inline.ts`).
 */
import {
  Block,
  Code,
  Heading,
  Html,
  Inline,
  List,
  ListItem,
  MAX_NESTING,
  Paragraph,
  Quote,
  Rule,
} from "./nodes.ts";
import { LinkDefinition, normalizeLabel, parseInline, plainText } from "./inline.ts";
import { parseTable } from "./table.ts";

const BLOCK_TAGS = new Set<string>([
  "address", "article", "aside", "base", "basefont", "blockquote", "body", "caption", "center",
  "col", "colgroup", "dd", "details", "dialog", "dir", "div", "dl", "dt", "fieldset", "figcaption",
  "figure", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head",
  "header", "hr", "html", "iframe", "legend", "li", "link", "main", "menu", "menuitem", "nav",
  "noframes", "ol", "optgroup", "option", "p", "param", "search", "section", "summary", "table",
  "tbody", "td", "tfoot", "th", "thead", "title", "tr", "track", "ul",
]);

const RULE = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;

class Marker {
  ordered: boolean;
  indent: number;
  bullet: string;
  delim: string;
  start: number;
  contentIndent: number;
  content: string;

  constructor(ordered: boolean, indent: number, bullet: string, delim: string, start: number, contentIndent: number, content: string) {
    this.ordered = ordered;
    this.indent = indent;
    this.bullet = bullet;
    this.delim = delim;
    this.start = start;
    this.contentIndent = contentIndent;
    this.content = content;
  }
}

class DefinitionMatch {
  label: string;
  definition: LinkDefinition;

  constructor(label: string, definition: LinkDefinition) {
    this.label = label;
    this.definition = definition;
  }
}

const isBlank = (line: string): boolean => line.trim().length === 0;

const leadingSpaces = (line: string): number => {
  let i = 0;
  while (i < line.length && line.charAt(i) === " ") i++;
  return i;
};

const stripIndent = (line: string, n: number): string => {
  let i = 0;
  while (i < line.length && i < n && line.charAt(i) === " ") i++;
  return line.slice(i);
};

const isHtmlStart = (line: string): boolean => {
  if (line.startsWith("<!--")) return true;
  const m = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s|\/?>|$)/.exec(line);
  if (m === null) return false;
  if (BLOCK_TAGS.has(m[1].toLowerCase())) return true;
  return /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>\s*$/.test(line);
};

const matchListMarker = (line: string): Marker | null => {
  const indent = leadingSpaces(line);
  if (indent > 3) return null;
  const s = line.slice(indent);
  if (RULE.test(s)) return null;
  const ul = /^([-+*])([ \t]+)(.*)$/.exec(s);
  if (ul !== null) {
    let spaces = ul[2].length;
    if (spaces > 4) spaces = 1;
    return new Marker(false, indent, ul[1], "", 0, indent + 1 + spaces, ul[3]);
  }
  const ol = /^(\d{1,9})([.)])([ \t]+)(.*)$/.exec(s);
  if (ol !== null) {
    let spaces = ol[3].length;
    if (spaces > 4) spaces = 1;
    return new Marker(true, indent, ol[2], ol[2], Number(ol[1]), indent + ol[1].length + 1 + spaces, ol[4]);
  }
  return null;
};

const sameList = (a: Marker, b: Marker): boolean =>
  a.ordered === b.ordered && a.indent === b.indent && (a.ordered ? a.delim === b.delim : a.bullet === b.bullet);

const isBlockStart = (line: string): boolean => {
  const indent = leadingSpaces(line);
  if (indent > 3) return false;
  const s = line.slice(indent);
  if (/^(`{3,}|~{3,})/.test(s)) return true;
  if (/^#{1,6}(?:[ \t]|$)/.test(s)) return true;
  if (RULE.test(s)) return true;
  if (s.startsWith(">")) return true;
  if (isHtmlStart(s)) return true;
  return matchListMarker(line) !== null;
};

/** `line` with the quote and list markers in front of it stripped, for a definition or fence inside a container. */
const containerContent = (line: string): string => {
  let s = line.replace(/^ {0,3}/, "");
  for (;;) {
    let changed = false;
    if (s.startsWith(">")) {
      s = s.slice(1);
      if (s.startsWith(" ")) s = s.slice(1);
      changed = true;
    }
    const m = /^([-+*]|\d{1,9}[.)])[ \t]+/.exec(s);
    if (m !== null) {
      s = s.slice(m[0].length);
      changed = true;
    }
    if (!changed) return s;
  }
};

const definitionOf = (rest: string): LinkDefinition | null => {
  const s = rest.trim();
  let i = 0;
  let href = "";
  if (s.charAt(0) === "<") {
    const close = s.indexOf(">");
    if (close < 0) return null;
    href = s.slice(1, close);
    i = close + 1;
  } else {
    const start = i;
    while (i < s.length && !/\s/.test(s.charAt(i))) i++;
    href = s.slice(start, i);
  }
  if (href.length === 0) return null;
  while (i < s.length && /\s/.test(s.charAt(i))) i++;
  let title = "";
  if (i < s.length) {
    const q = s.charAt(i);
    if (q !== '"' && q !== "'" && q !== "(") return null;
    const close = q === "(" ? ")" : q;
    const start = i + 1;
    let j = start;
    while (j < s.length && s.charAt(j) !== close) {
      if (s.charAt(j) === "\\") j++;
      j++;
    }
    if (s.charAt(j) !== close) return null;
    title = s.slice(start, j);
    i = j + 1;
    while (i < s.length && /\s/.test(s.charAt(i))) i++;
    if (i < s.length) return null;
  }
  return new LinkDefinition(href, title);
};

const matchDefinition = (line: string): DefinitionMatch | null => {
  const m = /^\[([^\]]+)\]:[ \t]*(.*)$/.exec(line);
  if (m === null) return null;
  const definition = definitionOf(m[2]);
  if (definition === null) return null;
  return new DefinitionMatch(m[1], definition);
};

const collectDefinitions = (lines: string[], defs: Map<string, LinkDefinition>): void => {
  let fence = "";
  let inHtml = false;
  for (const line of lines) {
    if (isBlank(line)) {
      inHtml = false;
      continue;
    }
    const content = containerContent(line);
    if (fence.length > 0) {
      const close = /^(`{3,}|~{3,})[ \t]*$/.exec(content);
      if (close !== null && close[1].charAt(0) === fence.charAt(0) && close[1].length >= fence.length) fence = "";
      continue;
    }
    const open = /^(`{3,}|~{3,})(.*)$/.exec(content);
    if (open !== null) {
      fence = open[1];
      continue;
    }
    if (inHtml) continue;
    if (isHtmlStart(content)) {
      inHtml = true;
      continue;
    }
    const definition = matchDefinition(content);
    if (definition !== null) defs.set(normalizeLabel(definition.label), definition.definition);
  }
};

const parseList = (lines: string[], at: number, defs: Map<string, LinkDefinition>, depth: number): { list: List; end: number } => {
  const first = matchListMarker(lines[at]) as Marker;
  const items: ListItem[] = [];
  let i = at;
  let end = at;
  while (i < lines.length) {
    while (i < lines.length && isBlank(lines[i])) i++;
    if (i >= lines.length) break;
    const marker = matchListMarker(lines[i]);
    if (marker === null || !sameList(first, marker)) break;
    let content = marker.content;
    let task = false;
    let checked = false;
    if (!marker.ordered) {
      const tm = /^\[([ xX])\][ \t]+(.*)$/.exec(content);
      if (tm !== null) {
        task = true;
        checked = tm[1].toLowerCase() === "x";
        content = tm[2];
      }
    }
    const itemLines: string[] = [content];
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) {
        let k = i + 1;
        while (k < lines.length && isBlank(lines[k])) k++;
        if (k >= lines.length) break;
        const next = matchListMarker(lines[k]);
        if (next !== null && sameList(first, next)) break;
        if (leadingSpaces(lines[k]) >= marker.contentIndent) {
          itemLines.push("");
          i++;
          continue;
        }
        break;
      }
      const next = matchListMarker(line);
      if (next !== null && sameList(first, next)) break;
      const lead = leadingSpaces(line);
      if (lead >= marker.contentIndent) {
        itemLines.push(stripIndent(line, marker.contentIndent));
        i++;
        continue;
      }
      if (!isBlockStart(line)) {
        itemLines.push(line.slice(Math.min(lead, 3)));
        i++;
        continue;
      }
      break;
    }
    items.push(new ListItem(parseBlocks(itemLines, defs, depth + 1), task, checked));
    end = i;
  }
  return { list: new List(first.ordered, first.ordered ? first.start : 1, items), end };
};

/** `depth` counts the quotes and list items around `lines`; past MAX_NESTING a marker stays text. */
const parseBlocks = (lines: string[], defs: Map<string, LinkDefinition>, depth: number): Block[] => {
  const out: Block[] = [];
  let pendingBlank = false;
  const emit = (block: Block): void => {
    block.blankBefore = pendingBlank;
    pendingBlank = false;
    out.push(block);
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      pendingBlank = true;
      i++;
      continue;
    }
    const indent = leadingSpaces(line);
    const s = indent <= 3 ? line.slice(indent) : line;
    const fence = indent <= 3 ? /^(`{3,}|~{3,})(.*)$/.exec(s) : null;
    if (fence !== null) {
      const char = fence[1].charAt(0);
      const length = fence[1].length;
      const content: string[] = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextIndent = leadingSpaces(next);
        const nextText = nextIndent <= 3 ? next.slice(nextIndent) : next;
        const close = nextIndent <= 3 ? /^(`{3,}|~{3,})[ \t]*$/.exec(nextText) : null;
        if (close !== null && close[1].charAt(0) === char && close[1].length >= length) {
          i++;
          break;
        }
        content.push(stripIndent(next, indent));
        i++;
      }
      emit(new Code(fence[2].trim(), content.join("\n")));
      continue;
    }
    const heading = indent <= 3 ? /^(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(s) : null;
    if (heading !== null) {
      let text = heading[2] === undefined ? "" : heading[2];
      text = text.replace(/[ \t]+#+[ \t]*$/, "");
      const children = parseInline(text, defs);
      emit(new Heading(heading[1].length, children, plainText(children)));
      i++;
      continue;
    }
    if (indent <= 3 && RULE.test(s)) {
      emit(new Rule());
      i++;
      continue;
    }
    if (indent <= 3 && isHtmlStart(s)) {
      let j = i;
      while (j < lines.length && !isBlank(lines[j])) j++;
      const html: string[] = [];
      for (let k = i; k < j; k++) html.push(stripIndent(lines[k], Math.min(leadingSpaces(lines[k]), 3)));
      emit(new Html(html.join("\n")));
      i = j;
      continue;
    }
    const table = parseTable(lines, i);
    if (table !== null) {
      emit(table.table);
      i = table.end;
      continue;
    }
    if (indent <= 3 && s.startsWith(">") && depth < MAX_NESTING) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const next = lines[i];
        const nextIndent = leadingSpaces(next);
        const nextText = nextIndent <= 3 ? next.slice(nextIndent) : next;
        if (nextText.startsWith(">")) {
          let rest = nextText.slice(1);
          if (rest.startsWith(" ")) rest = rest.slice(1);
          quoteLines.push(rest);
          i++;
          continue;
        }
        if (isBlank(next)) break;
        if (!isBlockStart(next)) {
          quoteLines.push(next.slice(Math.min(nextIndent, 3)));
          i++;
          continue;
        }
        break;
      }
      emit(new Quote(parseBlocks(quoteLines, defs, depth + 1)));
      continue;
    }
    if (indent <= 3 && depth < MAX_NESTING && matchListMarker(line) !== null) {
      const parsed = parseList(lines, i, defs, depth);
      emit(parsed.list);
      i = parsed.end;
      continue;
    }
    if (indent <= 3) {
      const definition = matchDefinition(s);
      if (definition !== null) {
        defs.set(normalizeLabel(definition.label), definition.definition);
        i++;
        continue;
      }
    }
    const paragraph: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (isBlank(next)) break;
      if (paragraph.length > 0 && (isBlockStart(next) || parseTable(lines, i) !== null)) break;
      paragraph.push(next.slice(Math.min(leadingSpaces(next), 3)));
      i++;
    }
    const children: Inline[] = parseInline(paragraph.join("\n"), defs);
    emit(new Paragraph(children));
  }
  return out;
};

/** `text` as blocks, its link reference definitions resolved across the whole document. */
export const parse = (text: string): Block[] => {
  const lines: string[] = [];
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  for (const line of normalized.split("\n")) lines.push(line);
  const defs = new Map<string, LinkDefinition>();
  collectDefinitions(lines, defs);
  return parseBlocks(lines, defs, 0);
};
