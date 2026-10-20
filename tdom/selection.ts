/**
 * @bootstrapp/light/tdom/selection: a selection in a windowed list, by
 * screen cells: the runs split where it starts and ends (drawn inverse), and
 * the text it holds as a copy gives it: each row's runs past its decoration
 * (a prompt's "› ", an indent), trailing spaces dropped, a row that continues
 * a wrapped line joined to it by what stood between them, other rows by
 * newlines.
 */
import { graphemes, graphemeWidth } from "./width.ts";
import { Line, LineSource, Run } from "./lines.ts";

/** `line`'s runs with cells `from` to `to` (-1: the end) drawn inverse. */
export const selectRuns = (line: Line, from: number, to: number): Run[] => {
  const out: Run[] = [];
  let at = 0;
  for (const r of line.runs) {
    let before = "";
    let inside = "";
    let after = "";
    for (const g of graphemes(r.text)) {
      if (at < from) before += g;
      else if (to < 0 || at < to) inside += g;
      else after += g;
      at += graphemeWidth(g);
    }
    if (before.length > 0) out.push(r.restyle(before));
    if (inside.length > 0) {
      const c = r.restyle(inside);
      c.inverse = !r.inverse;
      out.push(c);
    }
    if (after.length > 0) out.push(r.restyle(after));
  }
  return out;
};

/** The text of `line`'s cells `from` to `to` (-1: the end), its decoration left out. */
export const rowText = (line: Line, from: number, to: number): string => {
  let out = "";
  let at = 0;
  line.runs.forEach((r: Run, i: number) => {
    for (const g of graphemes(r.text)) {
      if (i >= line.decor && at >= from && (to < 0 || at < to)) out += g;
      at += graphemeWidth(g);
    }
  });
  return out;
};

/** The text a copy of rows `from` (from cell `fromCell`) to `to` (before cell `toCell`, -1 the end) gives. */
export const copyRows = (source: LineSource, from: number, fromCell: number, to: number, toCell: number, width: number): string => {
  const special = source.copyText(from, fromCell, to, toCell, width);
  if (special !== null) return special;
  let out = "";
  const last = Math.min(to, source.count() - 1);
  for (let i = Math.max(0, from); i <= last; i++) {
    const l = source.line(i, width);
    if (i > from) out += l.wrapped ? l.joint : "\n";
    out += rowText(l, i === from ? fromCell : 0, i === to ? toCell : -1).replace(/\s+$/, "");
  }
  return out;
};

/** The part of `text` in cells `from` to `to` (-1: the end). */
export const sliceCells = (text: string, from: number, to: number): string => {
  let out = "";
  let at = 0;
  for (const g of graphemes(text)) {
    if (at >= from && (to < 0 || at < to)) out += g;
    at += graphemeWidth(g);
  }
  return out;
};
