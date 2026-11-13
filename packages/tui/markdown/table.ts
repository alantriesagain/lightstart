/**
 * @file A Markdown table as terminal lines: the cells in columns separated by a bar, the header in bold
 * over a rule, each column as wide as its widest cell while the row fits the width, else the
 * widest columns narrowed and their cells wrapped onto more rows; too many columns for the width
 * list each row as "header: value" lines instead. A cell keeps its inline styles; `\|` is a bar in
 * a cell, and a bar inside `code` does not split it.
 */
import { palette } from "@light/ui/palette.ts";
import { Line, Run } from "@lightstart/light/native/tui/lines.ts";
import { wrap } from "@light/ui/text.ts";
import { stringWidth } from "@lightstart/light/native/tui/width.ts";
import { Table } from "@lightstart/markdown";
import type { Align } from "@lightstart/markdown";

export { Table, cells, parseTable } from "@lightstart/markdown";
export type { Align } from "@lightstart/markdown";

const BAR = " │ ";
/** A column narrows no further than this; past it the table lists its rows instead. */
const MIN_COLUMN = 6;

const widthOf = (runs: Run[]): number => {
  let w = 0;
  for (const r of runs) w += stringWidth(r.text);
  return w;
};

/** The columns' widths: each its widest cell, the widest narrowed one cell at a time while the row is wider than `room`; null when even the narrowest do not fit. */
const columnWidths = (natural: number[], room: number): number[] | null => {
  const widths = natural.slice();
  const bars = BAR.length * (widths.length - 1);
  let total = bars;
  for (const w of widths) total += w;
  while (total > room) {
    let widest = -1;
    for (let i = 0; i < widths.length; i++) if (widths[i] > MIN_COLUMN && (widest < 0 || widths[i] > widths[widest])) widest = i;
    if (widest < 0) return null;
    widths[widest]--;
    total--;
  }
  return widths;
};

/** `runs` padded to `width` cells as `align` says; a left-aligned last column keeps its end bare. */
const pad = (runs: Run[], width: number, align: Align, last: boolean): Run[] => {
  const gap = width - widthOf(runs);
  if (gap <= 0) return runs;
  const left = align === "right" ? gap : align === "center" ? Math.floor(gap / 2) : 0;
  const out: Run[] = [];
  if (left > 0) out.push(new Run(" ".repeat(left), ""));
  for (const r of runs) out.push(r);
  if (gap - left > 0 && !(last && align === "left")) out.push(new Run(" ".repeat(gap - left), ""));
  return out;
};

const withIndent = (indent: Run[], runs: Run[], wrapped: boolean): Line => {
  const l = new Line();
  l.decor = indent.length;
  for (const r of indent) l.runs.push(r.restyle(r.text));
  for (const r of runs) l.runs.push(r);
  l.wrapped = wrapped;
  return l;
};

/** Every row as "header: value" lines, a short rule between rows: the shape for more columns than the width holds. */
const listed = (styled: Run[][][], width: number, indent: Run[], room: number): Line[] => {
  const out: Line[] = [];
  let labelWidth = 0;
  for (const h of styled[0]) labelWidth = Math.max(labelWidth, widthOf(h));
  labelWidth = Math.min(labelWidth, Math.max(4, Math.floor(room / 3)));
  const dim = (runs: Run[]): Run[] =>
    runs.map((r: Run) => {
      const c = r.restyle(r.text);
      c.fg = palette.dim;
      return c;
    });
  for (let r = 1; r < styled.length; r++) {
    if (r > 1) out.push(withIndent(indent, [new Run("─".repeat(Math.min(room, 24)), palette.dim)], false));
    for (let i = 0; i < styled[0].length; i++) {
      const label = pad(dim(styled[0][i]), labelWidth, "left", false).concat([new Run(": ", palette.dim)]);
      const first = indent.concat(label);
      const rest = indent.concat([new Run(" ".repeat(labelWidth + 2), "")]);
      for (const l of wrap(styled[r][i], width, first, rest, "")) out.push(l);
    }
  }
  return out;
};

/**
 * `table` as lines `width` cells wide, every line starting with `indent`; `style` renders a cell's
 * text as runs (its inline styles), bold for the header.
 */
export const renderTable = (table: Table, width: number, indent: Run[], style: (text: string, bold: boolean) => Run[]): Line[] => {
  let indentWidth = 0;
  for (const r of indent) indentWidth += stringWidth(r.text);
  const room = Math.max(1, width - indentWidth);
  const n = table.header.length;
  const styled: Run[][][] = [table.header.map((c: string) => style(c, true))];
  for (const row of table.rows) styled.push(row.map((c: string) => style(c, false)));
  const natural: number[] = [];
  for (let i = 0; i < n; i++) natural.push(1);
  for (const row of styled) for (let i = 0; i < n; i++) natural[i] = Math.max(natural[i], widthOf(row[i]));
  const widths = columnWidths(natural, room);
  if (widths === null) return listed(styled, width, indent, room);
  const out: Line[] = [];
  for (let r = 0; r < styled.length; r++) {
    const cellLines = styled[r].map((runs: Run[], i: number) => wrap(runs, widths[i], [], [], ""));
    let height = 1;
    for (const ls of cellLines) height = Math.max(height, ls.length);
    for (let k = 0; k < height; k++) {
      const runs: Run[] = [];
      for (let i = 0; i < n; i++) {
        if (i > 0) runs.push(new Run(BAR, palette.dim));
        const cl = cellLines[i][k];
        for (const x of pad(cl !== undefined ? cl.runs : [], widths[i], table.aligns[i], i === n - 1)) runs.push(x);
      }
      out.push(withIndent(indent, runs, k > 0));
    }
    if (r === 0) out.push(withIndent(indent, [new Run(widths.map((w: number) => "─".repeat(w)).join("─┼─"), palette.dim)], false));
  }
  return out;
};
