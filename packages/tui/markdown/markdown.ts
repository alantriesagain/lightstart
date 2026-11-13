/**
 * @file Markdown as terminal lines over one parser (`@lightstart/markdown`). Each source line is
 * rendered on its own (a soft break starts a new line, as Claude writes one paragraph per line):
 * headings bold and colored, list items with a bullet and a hanging indent, quotes behind a bar,
 * fenced code on a tinted background without wrapping, tables in columns (table.ts), rules as a
 * line; inline code, bold, italic, links, images, wiki links and raw HTML styled. Raw HTML stays
 * text.
 *
 * A label goes as it is on a first line that is not a wrapped paragraph (a fence, a rule).
 */
import { palette } from "@light/ui/palette.ts";
import { Line, Run } from "@lightstart/light/native/tui/lines.ts";
import { clipText, expandTabs, wrap } from "@light/ui/text.ts";
import { HlState, languageForFence, TOKEN_COLORS, tokenizeLine } from "@light/highlight";
import {
  Code,
  CodeSpan,
  Del,
  Em,
  HardBreak,
  Heading,
  Html,
  Image,
  InlineHtml,
  Link,
  List,
  Paragraph,
  Quote,
  Rule,
  SoftBreak,
  Strong,
  Text,
  WikiLink,
  parse,
  parseInline,
} from "@lightstart/markdown";
import type { Block, Inline } from "@lightstart/markdown";
import { Table, renderTable } from "./table.ts";

const makeRun = (text: string, fg: string, bold: boolean, italic: boolean, underline: boolean, dim: boolean): Run => {
  const r = new Run(text, fg);
  r.bold = bold;
  r.italic = italic;
  r.underline = underline;
  r.dim = dim;
  return r;
};

const addInline = (out: Run[], nodes: Inline[], fg: string, bold: boolean, italic: boolean, underline: boolean, dim: boolean): void => {
  for (const node of nodes) {
    if (node instanceof Strong) addInline(out, node.children, fg, true, italic, underline, dim);
    else if (node instanceof Em) addInline(out, node.children, fg, bold, true, underline, dim);
    else if (node instanceof Del) addInline(out, node.children, fg, bold, italic, underline, true);
    else if (node instanceof Text) out.push(makeRun(node.text, fg, bold, italic, underline, dim));
    else if (node instanceof CodeSpan) out.push(makeRun(node.text, palette.code, bold, italic, false, dim));
    else if (node instanceof Link) addInline(out, node.children, palette.link, bold, italic, true, dim);
    else if (node instanceof Image) out.push(makeRun(node.alt, fg, bold, italic, underline, dim));
    else if (node instanceof WikiLink) out.push(makeRun(node.display, fg, bold, italic, underline, dim));
    else if (node instanceof InlineHtml) out.push(makeRun(node.text, fg, bold, italic, underline, dim));
    else if (node instanceof HardBreak) out.push(makeRun("\n", fg, bold, italic, underline, dim));
    else if (node instanceof SoftBreak) out.push(makeRun("\n", fg, bold, italic, underline, dim));
  }
};

/** Inline styles over one line of text, as runs on top of `fg`. */
export const inline = (text: string, fg: string, bold: boolean): Run[] => {
  const out: Run[] = [];
  addInline(out, parseInline(text), fg, bold, false, false, false);
  return out;
};

const spaces = (n: number): Run[] => (n > 0 ? [new Run(" ".repeat(n), "")] : []);

const renderCode = (block: Code, width: number, indent: Run[], fg: string, out: Line[]): void => {
  const language = languageForFence(block.info);
  const state = new HlState();
  if (block.text.length === 0) return;
  for (const source of block.text.split("\n")) {
    const l = new Line();
    for (const r of indent) l.runs.push(r);
    const code = clipText(expandTabs(source), Math.max(1, width - 2));
    l.add("  ", fg);
    if (language.length === 0) l.add(code, fg);
    else {
      let at = 0;
      for (const t of tokenizeLine(language, code, state)) {
        if (t.from > at) l.add(code.slice(at, t.from), fg);
        const run = l.add(code.slice(t.from, t.to), TOKEN_COLORS.get(t.type) ?? fg);
        if (t.type === "comment") run.italic = true;
        at = t.to;
      }
      if (at < code.length) l.add(code.slice(at), fg);
    }
    l.bg = palette.codeBg;
    out.push(l);
  }
};

const renderList = (list: List, width: number, indent: Run[], fg: string, out: Line[]): void => {
  let number = list.start;
  for (const item of list.items) {
    let marker = list.ordered ? String(number) + ". " : "• ";
    if (item.task) marker += item.checked ? "[x] " : "[ ] ";
    const rest = indent.concat(spaces(marker.length));
    const rendered: Line[] = [];
    renderBlocks(item.blocks, width, rest, fg, rendered);
    if (rendered.length === 0) {
      const l = new Line();
      for (const r of indent) l.runs.push(r);
      l.add(marker, palette.dim);
      out.push(l);
    } else {
      const line = rendered[0];
      // The indent's runs are shared by every line of the item, so the marker replaces the first
      // line's run rather than writing into it.
      if (line.runs.length > indent.length) line.runs[indent.length] = new Run(marker, palette.dim);
      else line.runs.push(new Run(marker, palette.dim));
      for (const l of rendered) out.push(l);
    }
    number++;
  }
};

const renderBlock = (block: Block, width: number, indent: Run[], fg: string, out: Line[]): void => {
  if (block instanceof Heading) {
    const runs: Run[] = [];
    addInline(runs, block.children, palette.link, true, false, false, false);
    for (const l of wrap(runs, width, indent, indent, "")) out.push(l);
    return;
  }
  if (block instanceof Paragraph) {
    const runs: Run[] = [];
    addInline(runs, block.children, fg, false, false, false, false);
    for (const l of wrap(runs, width, indent, indent, "")) out.push(l);
    return;
  }
  if (block instanceof Code) {
    renderCode(block, width, indent, fg, out);
    return;
  }
  if (block instanceof Rule) {
    const l = new Line();
    for (const r of indent) l.runs.push(r);
    l.runs.push(new Run("─".repeat(Math.max(1, Math.min(width - 2, 60))), palette.dim));
    out.push(l);
    return;
  }
  if (block instanceof Table) {
    for (const l of renderTable(block, width, indent, (cell: string, bold: boolean) => inline(cell, fg, bold))) out.push(l);
    return;
  }
  if (block instanceof Quote) {
    const bar = indent.concat([new Run("│ ", palette.dim)]);
    renderBlocks(block.blocks, width, bar, palette.dim, out);
    return;
  }
  if (block instanceof List) {
    renderList(block, width, indent, fg, out);
    return;
  }
  if (block instanceof Html) {
    for (const source of block.text.split("\n")) {
      for (const l of wrap([new Run(source, fg)], width, indent, indent, "")) out.push(l);
    }
  }
};

const renderBlocks = (blocks: Block[], width: number, indent: Run[], fg: string, out: Line[]): void => {
  let first = true;
  for (const block of blocks) {
    if (!first && block.blankBefore) {
      const l = new Line();
      for (const r of indent) l.runs.push(r);
      out.push(l);
    }
    renderBlock(block, width, indent, fg, out);
    first = false;
  }
};

/**
 * `text` as lines `width` cells wide, every line starting with `indent` (runs, usually spaces or
 * a nesting bar), in `fg`.
 */
export const renderMarkdown = (text: string, width: number, indent: Run[], fg: string, first: Run[] = []): Line[] => {
  const out: Line[] = [];
  renderBlocks(parse(text), width, indent, fg, out);
  if (first.length > 0 && out.length > 0) out[0].runs = first.concat(out[0].runs);
  return out;
};
