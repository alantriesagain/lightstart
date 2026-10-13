/**
 * @bootstrapp/light/tdom/wrap: line wrapping over styled inline runs. The
 * output is a list of visual lines made of cells, each a grapheme with its
 * width and style, ready to paint.
 */
import { Style } from "./style.ts";
import { graphemeWidth, graphemes } from "./width.ts";

export class Cell {
  g: string;
  w: number;
  style: Style;

  constructor(g: string, w: number, style: Style) {
    this.g = g;
    this.w = w;
    this.style = style;
  }
}

export class InlineRun {
  text: string;
  style: Style;

  constructor(text: string, style: Style) {
    this.text = text;
    this.style = style;
  }
}

export class WrappedLine {
  cells: Cell[];
  width: number;

  constructor(cells: Cell[], width: number) {
    this.cells = cells;
    this.width = width;
  }
}

const lineOf = (cells: Cell[]) => {
  let w = 0;
  for (const c of cells) w += c.w;
  return new WrappedLine(cells, w);
};

/**
 * Wrap runs to `width` cells. "word" breaks after spaces (dropping the
 * space) and falls back to character breaks for words longer than the
 * width; "char" breaks anywhere; "none" breaks only at newlines. Newlines
 * always break. A zero width wraps at one cell.
 */
export const wrapRuns = (runs: InlineRun[], width: number, mode: string): WrappedLine[] => {
  const maxW = width < 1 ? 1 : width;
  const lines: WrappedLine[] = [];
  let cells: Cell[] = [];
  let lineW = 0;
  let lastSpace = -1;

  const flush = () => {
    lines.push(lineOf(cells));
    cells = [];
    lineW = 0;
    lastSpace = -1;
  };

  for (const run of runs)
    for (const g of graphemes(run.text)) {
      if (g === "\n") {
        flush();
        continue;
      }
      if (g === "\r") continue;
      const w = graphemeWidth(g);
      if (mode !== "none" && lineW + w > maxW && cells.length > 0) {
        if (g === " ") {
          flush();
          continue;
        }
        if (mode === "word" && lastSpace >= 0) {
          const carry = cells.slice(lastSpace + 1);
          cells = cells.slice(0, lastSpace);
          flush();
          cells = carry;
          lineW = 0;
          for (const c of cells) lineW += c.w;
          lastSpace = -1;
          if (lineW + w > maxW && cells.length > 0) flush();
        } else flush();
      }
      if (g === " ") lastSpace = cells.length;
      cells.push(new Cell(g, w, run.style));
      lineW += w;
    }
  flush();
  return lines;
};

/**
 * The plain text of a wrapped line, for tests and dumps.
 */
export const lineText = (line: WrappedLine) => {
  let s = "";
  for (const c of line.cells) s += c.g;
  return s;
};
