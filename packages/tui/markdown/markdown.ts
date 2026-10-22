/**
 * @file Claude's Markdown as terminal lines. Each source line is rendered on its own (Claude writes one
 * paragraph per line): headings bold and colored, list items with a bullet and a hanging indent,
 * quotes behind a bar, fenced code on a tinted background without wrapping, tables in columns
 * (table.ts), rules as a line; inline `code`, **bold**, *italic* and [links](url) styled. Raw HTML
 * stays text.
 *
 * A label goes as it is on a first line that is not a wrapped paragraph (a fence, a rule).
 */
import { palette } from "@light/ui/palette.ts";
import { Line, Run } from "@bootstrapp/light/native/tui/lines.ts";
import { clipText, expandTabs, wrap } from "@light/ui/text.ts";
import { HlState, languageForFence, TOKEN_COLORS, tokenizeLine } from "@light/highlight";
import { parseTable, renderTable } from "./table.ts";


const run = (text: string, fg: string, bold: boolean, italic: boolean): Run => {
  const r = new Run(text, fg);
  r.bold = bold;
  r.italic = italic;
  return r;
};

/** Inline styles over one line of text, as runs on top of `fg`. */
export const inline = (text: string, fg: string, bold: boolean): Run[] => {
  const out: Run[] = [];
  let buf = "";
  let isBold = bold;
  let italic = false;
  const flush = (): void => {
    if (buf.length > 0) out.push(run(buf, fg, isBold, italic));
    buf = "";
  };
  let i = 0;
  while (i < text.length) {
    const c = text.charAt(i);
    if (c === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push(run(text.slice(i + 1, end), palette.code, isBold, italic));
        i = end + 1;
        continue;
      }
    }
    if (c === "*" && text.charAt(i + 1) === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2 || isBold !== bold) {
        flush();
        isBold = isBold === bold ? true : bold;
        i += 2;
        continue;
      }
    }
    if (c === "*" && text.charAt(i + 1) !== " " && (italic || text.indexOf("*", i + 1) > i + 1)) {
      flush();
      italic = !italic;
      i++;
      continue;
    }
    if (c === "[") {
      const close = text.indexOf("](", i + 1);
      const end = close > i ? text.indexOf(")", close + 2) : -1;
      if (close > i && end > close) {
        flush();
        const link = run(text.slice(i + 1, close), palette.link, isBold, italic);
        link.underline = true;
        out.push(link);
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
};

const spaces = (n: number): Run[] => (n > 0 ? [new Run(" ".repeat(n), "")] : []);

/**
 * `text` as lines `width` cells wide, every line starting with `indent` (runs, usually spaces or
 * a nesting bar), in `fg`.
 */
export const renderMarkdown = (text: string, width: number, indent: Run[], fg: string, first: Run[] = []): Line[] => {
  const out: Line[] = [];
  let fence = "";
  let fenceLanguage = "";
  let fenceState = new HlState();
  /** The first line's own prefix (a message's label), used once, on the first line drawn. */
  let lead: Run[] | null = first.length > 0 ? first : null;
  const leaded = (runs: Run[]): Run[] => {
    const l = lead;
    lead = null;
    return l === null ? runs : l.concat(runs);
  };
  const withIndent = (runs: Run[]): Run[] => {
    const all: Run[] = [];
    for (const r of indent) all.push(r);
    for (const r of runs) all.push(r);
    return all;
  };
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const source = lines[i];
    const trimmed = source.trim();
    if (fence.length > 0) {
      if (trimmed.startsWith(fence)) {
        fence = "";
        continue;
      }
      const l = new Line();
      const code = clipText(expandTabs(source), Math.max(1, width - 2));
      for (const r of indent) l.runs.push(r);
      l.add("  ", fg);
      if (fenceLanguage.length === 0) l.add(code, fg);
      else {
        let at = 0;
        for (const t of tokenizeLine(fenceLanguage, code, fenceState)) {
          if (t.from > at) l.add(code.slice(at, t.from), fg);
          const run = l.add(code.slice(t.from, t.to), TOKEN_COLORS.get(t.type) ?? fg);
          if (t.type === "comment") run.italic = true;
          at = t.to;
        }
        if (at < code.length) l.add(code.slice(at), fg);
      }
      l.bg = palette.codeBg;
      out.push(l);
      continue;
    }
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      fence = trimmed.slice(0, 3);
      fenceLanguage = languageForFence(trimmed.slice(3));
      fenceState = new HlState();
      continue;
    }
    if (trimmed.length === 0) {
      const l = new Line();
      for (const r of indent) l.runs.push(r);
      out.push(l);
      continue;
    }
    const table = parseTable(lines, i);
    if (table !== null) {
      for (const l of renderTable(table.table, width, indent, (cell, bold) => inline(cell, fg, bold))) out.push(l);
      i = table.end - 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading !== null) {
      const runs = inline(heading[2], palette.link, true);
      for (const l of wrap(runs, width, leaded(indent), indent, "")) out.push(l);
      continue;
    }
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      const l = new Line();
      for (const r of indent) l.runs.push(r);
      l.runs.push(new Run("─".repeat(Math.max(1, Math.min(width - 2, 60))), palette.dim));
      out.push(l);
      continue;
    }
    if (trimmed.startsWith("|")) {
      const l = new Line();
      for (const r of withIndent([new Run(source, fg)])) l.runs.push(r);
      out.push(l);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote !== null) {
      const bar = withIndent([new Run("│ ", palette.dim)]);
      for (const l of wrap(inline(quote[1], palette.dim, false), width, leaded(bar), bar, "")) out.push(l);
      continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(source);
    if (item !== null) {
      const depth = Math.floor(item[1].replace(/\t/g, "  ").length / 2);
      const marker = /\d/.test(item[2]) ? item[2] + " " : "• ";
      const first = withIndent(spaces(depth * 2).concat([new Run(marker, palette.dim)]));
      const rest = withIndent(spaces(depth * 2 + marker.length));
      for (const l of wrap(inline(item[3], fg, false), width, leaded(first), rest, "")) out.push(l);
      continue;
    }
    for (const l of wrap(inline(trimmed, fg, false), width, leaded(indent), indent, "")) out.push(l);
  }
  if (lead !== null && out.length > 0) out[0].runs = lead.concat(out[0].runs);
  return out;
};
