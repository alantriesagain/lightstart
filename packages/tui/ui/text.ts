/**
 * @file Word wrapping over styled runs, for the chat: words move whole to the next line, a word longer
 * than the width breaks by characters, a newline starts a new line, and continuation lines start
 * with a hanging indent (a list's or a quote's). Widths count terminal cells (wide characters take
 * two). A line never holds a newline: a row on the screen is one line.
 *
 * Text joins the last run when it looks the same, but never a decoration run (the prefix a copy
 * leaves out). A word wider than the room breaks by characters.
 */
import { graphemes, graphemeWidth, stringWidth } from "@bootstrapp/light/native/tui/width.ts";
import { Line, Run } from "@bootstrapp/light/native/tui/lines.ts";

class Piece {
  run: Run;
  text: string;
  width: number;
  space: boolean;
  /** A newline: what follows starts a new line. */
  newline = false;

  constructor(run: Run, text: string, width: number, space: boolean) {
    this.run = run;
    this.text = text;
    this.width = width;
    this.space = space;
  }
}

/** Split runs into words, the spaces between them and newlines, keeping each piece's run. */
const pieces = (runs: Run[]): Piece[] => {
  const out: Piece[] = [];
  for (const r of runs) {
    let word = "";
    let inSpace = false;
    for (const ch of r.text) {
      if (ch === "\r") continue;
      if (ch === "\n") {
        if (word.length > 0) out.push(new Piece(r, word, stringWidth(word), inSpace));
        word = "";
        inSpace = false;
        const brk = new Piece(r, "", 0, false);
        brk.newline = true;
        out.push(brk);
        continue;
      }
      const isSpace = ch === " ";
      if (word.length > 0 && isSpace !== inSpace) {
        out.push(new Piece(r, word, stringWidth(word), inSpace));
        word = "";
      }
      inSpace = isSpace;
      word += ch;
    }
    if (word.length > 0) out.push(new Piece(r, word, stringWidth(word), inSpace));
  }
  return out;
};

/** Append `text` in `run`'s style, joining the last run when the style is the same object. */
const push = (line: Line, run: Run, text: string): void => {
  const last = line.runs.length > line.decor ? line.runs[line.runs.length - 1] : null;
  if (last !== null && last.fg === run.fg && last.bg === run.bg && last.bold === run.bold && last.dim === run.dim && last.italic === run.italic && last.underline === run.underline) last.text += text;
  else line.runs.push(run.restyle(text));
};

/**
 * Wrap `runs` to `width` cells, a newline in them starting a new line. The first visual line starts
 * with `first`, the others with `rest` (both runs, usually spaces or a quote bar); `bg` colors every row.
 */
export const wrap = (runs: Run[], width: number, first: Run[], rest: Run[], bg: string): Line[] => {
  const lines: Line[] = [];
  const start = (prefix: Run[]): Line => {
    const l = new Line();
    l.bg = bg;
    l.decor = prefix.length;
    for (const p of prefix) l.runs.push(p.restyle(p.text));
    lines.push(l);
    return l;
  };
  let prefixWidth = 0;
  for (const p of first) prefixWidth += stringWidth(p.text);
  let restWidth = 0;
  for (const p of rest) restWidth += stringWidth(p.text);
  let line = start(first);
  let used = prefixWidth;
  let room = Math.max(1, width);
  for (const piece of pieces(runs)) {
    if (piece.newline) {
      const last = line.runs.length > line.decor ? line.runs[line.runs.length - 1] : null;
      if (last !== null) last.text = last.text.replace(/ +$/, "");
      line = start(rest);
      used = restWidth;
      continue;
    }
    if (piece.space) {
      if (used > (lines.length === 1 ? prefixWidth : restWidth) && used + piece.width <= room) {
        push(line, piece.run, piece.text);
        used += piece.width;
      }
      continue;
    }
    if (used + piece.width > room && used > (lines.length === 1 ? prefixWidth : restWidth)) {
      const last = line.runs.length > 0 ? line.runs[line.runs.length - 1] : null;
      if (last !== null) last.text = last.text.replace(/ +$/, "");
      line = start(rest);
      line.wrapped = true;
      used = restWidth;
    }
    if (used + piece.width <= room) {
      push(line, piece.run, piece.text);
      used += piece.width;
      continue;
    }
    for (const g of graphemes(piece.text)) {
      const w = graphemeWidth(g);
      if (used + w > room && used > restWidth) {
        line = start(rest);
        line.wrapped = true;
        line.joint = "";
        used = restWidth;
      }
      push(line, piece.run, g);
      used += w;
    }
    room = Math.max(1, width);
  }
  return lines;
};

/** Tabs to spaces at `tab`-cell stops, counting graphemes as the screen does (a wide character takes two cells). */
export const expandTabs = (text: string, tab = 4): string => {
  if (!text.includes("\t")) return text;
  let out = "";
  let col = 0;
  for (const g of graphemes(text)) {
    if (g === "\t") {
      const n = tab - (col % tab);
      out += " ".repeat(n);
      col += n;
    } else {
      out += g;
      col += graphemeWidth(g);
    }
  }
  return out;
};

/** Cut `text` to `width` cells, ending with "…" when it was longer. */
export const clipText = (text: string, width: number): string => {
  if (stringWidth(text) <= width) return text;
  let out = "";
  let used = 0;
  for (const g of graphemes(text)) {
    const w = graphemeWidth(g);
    if (used + w > width - 1) break;
    out += g;
    used += w;
  }
  return out + "…";
};
