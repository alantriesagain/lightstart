/**
 * @bootstrapp/light/tdom/lines: styled lines, the unit a windowed list
 * draws. A `Run` is a piece of a line in one style ("" colors inherit;
 * `inverse` draws it with its colors swapped, a selection; `live` names what
 * moves on its own, "spinner" drawn as the spinner's frame of the moment). A
 * `Line` is its runs and the row's background, what a press on it acts on
 * (`tag`), how many leading runs only decorate (`decor`: a prompt's "› ", an
 * indent, left out of a copy), and whether it continues the row above
 * (`wrapped`, joined back by `joint` in a copy). A `LineSource` answers a
 * count and builds a line on demand for a width, so a long transcript or
 * file is never one node per line: a `LineView` asks for the visible window
 * only. No view code here, so what renders lines, and its tests, stay free
 * of the terminal tree.
 */

export class Run {
  text: string;
  fg: string;
  bg: string;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  live: string;

  constructor(text: string, fg: string) {
    this.text = text;
    this.fg = fg;
    this.bg = "";
    this.bold = false;
    this.dim = false;
    this.italic = false;
    this.underline = false;
    this.inverse = false;
    this.live = "";
  }

  /** A run with `text` in this run's style, its inverse and live marks included. */
  restyle(text: string): Run {
    const c = new Run(text, this.fg);
    c.bg = this.bg;
    c.bold = this.bold;
    c.dim = this.dim;
    c.italic = this.italic;
    c.underline = this.underline;
    c.inverse = this.inverse;
    c.live = this.live;
    return c;
  }
}

export class Line {
  runs: Run[] = [];
  bg = "";
  tag: unknown = null;
  decor = 0;
  wrapped = false;
  joint = " ";

  /** Add a run of `text` in `fg`; answers it, for its other styles. */
  add(text: string, fg: string): Run {
    const r = new Run(text, fg);
    this.runs.push(r);
    return r;
  }
}

/**
 * What a `LineView` shows: `count` lines, each built for a width when it
 * scrolls into view. `prepare` runs before each render with the width the
 * lines get. `liveFrom` is the first line that changes on its own while it
 * is shown (a spinner, a clock) and every line after it, or `count()` when
 * none does: the view draws that tail apart and redraws it alone on each
 * tick. `copyText` is the text a copy of rows `from` (from cell `fromCell`)
 * to `to` (before cell `toCell`, -1 for the row's end) gives when the source
 * knows better than its rows (a file's own lines), or null for the rows'
 * text.
 */
export abstract class LineSource {
  prepare(_width: number): void {}

  count(): number {
    return 0;
  }

  line(index: number, _width: number): Line {
    throw new Error(`[tdom] LineSource.line(${index}): the source answers count() but not line()`);
  }

  liveFrom(): number {
    return this.count();
  }

  copyText(_from: number, _fromCell: number, _to: number, _toCell: number, _width: number): string | null {
    return null;
  }
}
