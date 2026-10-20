/**
 * @bootstrapp/light/tdom/line-view: a pane of styled lines that renders only
 * the rows that fit. The terminal layout measures every child, so a long
 * transcript or file never becomes one node per line: a `LineSource` answers
 * the line count and builds a line on demand, and the view asks for the
 * visible window only, each row a `<p wrap="none">` of `<span>` runs. The
 * view owns its scroll offset (the wheel, `scroll`, `page`, `toEnd`; `follow`
 * keeps the last line in view as lines come, and once `followable` a scroll
 * back to the end turns it on again) and turns a press into a `press` event
 * (a `LinePress`: the line's index and the column) its owner handles with
 * `@press=`. A drag selects by cells instead (drawn inverse, scrolling when it
 * runs past the top or bottom), and its release says what it selected with a
 * `copy` event (a `LineCopy`: the text and the rows it spans). Its last cell
 * is a scrollbar while the lines overflow it: a press on the track brings the
 * thumb there, a drag moves it. Its size is the box's arranged size, read
 * after each frame; a change re-renders it on the next one. A source's live
 * tail (`LineSource.liveFrom`: a spinner, a clock) is drawn by a child view,
 * which the view redraws on its own on each tick while there is one, the rows
 * above it staying as drawn; a run marked live is drawn as the spinner's
 * frame. With `fit` the view shows every line and no scrollbar, as tall as
 * its lines: a strip of a status band. The bar's colors are the view's
 * `trackFg`, `thumbFg` and `heldFg`.
 */
import { html } from "../html/core.ts";
import { MouseEvent, WheelEvent } from "./events.ts";
import { Line, LineSource } from "./lines.ts";
import { FLUSH_AFTER, frames } from "./scheduler.ts";
import { barCell, thumbOf, topAt } from "./scrollbar.ts";
import { copyRows, selectRuns } from "./selection.ts";
import { onTick, spinnerAt } from "./ticks.ts";
import { View } from "./view.ts";

/** What a press on a line says: the line's index and the column within the pane. */
export class LinePress {
  readonly index: number;
  readonly column: number;

  constructor(index: number, column: number) {
    this.index = index;
    this.column = column;
  }
}

/** What a drag selected: its text and the rows it spans. */
export class LineCopy {
  readonly text: string;
  readonly rows: number;

  constructor(text: string, rows: number) {
    this.text = text;
    this.rows = rows;
  }
}

class EmptySource extends LineSource {
  count(): number {
    return 0;
  }

  line(_index: number, _width: number): Line {
    return new Line();
  }
}

const colorOr = (c: string): string => (c.length > 0 ? c : "default");

const oneRow = (text: string): string => (text.indexOf("\n") >= 0 ? text.replace(/\n/g, " ") : text);

/** A line as a row of spans, a live run as the spinner's frame at `now`. */
export const lineTemplate = (l: Line, now: number): unknown =>
  html`<p wrap="none" bg=${colorOr(l.bg)}>${l.runs.map(
    (r) => html`<span fg=${colorOr(r.fg)} bg=${colorOr(r.bg)} bold=${r.bold} dim=${r.dim} italic=${r.italic} underline=${r.underline} inverse=${r.inverse}>${r.live === "spinner" ? spinnerAt(now) : oneRow(r.text)}</span>`,
  )}</p>`;

class LiveRows extends View {
  private readonly lines: () => Line[];

  constructor(lines: () => Line[]) {
    super();
    this.lines = lines;
  }

  refresh(): void {
    this.$requestUpdate();
  }

  override render(): unknown {
    const rows = this.lines();
    if (rows.length === 0) return html``;
    const now = Date.now();
    return html`<div>${rows.map((l) => lineTemplate(l, now))}</div>`;
  }
}

export class LineView extends View {
  source: LineSource = new EmptySource();
  top = 0;
  follow = false;
  followable = false;
  fit = false;
  rows = 0;
  cols = 0;
  trackFg = "gray";
  thumbFg = "white";
  heldFg = "cyan";
  private holding = false;
  private moved = false;
  private pressX = 0;
  private pressY = 0;
  private pressRow = 0;
  private fromRow = 0;
  private fromCell = 0;
  private toRow = 0;
  private toCell = 0;
  private grab = -1;
  private grabStart = 0;
  private grabTop = 0;
  private readonly live = new LiveRows(() => this.liveLines());

  constructor() {
    super();
    this.box.flex = 1;
  }

  override connected(): void {
    this.$own(frames.onFlush(() => this.measure(), FLUSH_AFTER));
    this.$own(
      onTick(() => {
        this.source.prepare(this.cols);
        if (this.source.liveFrom() < this.source.count()) this.refreshLive();
      }),
    );
  }

  /** Render again (the source changed). */
  refresh(): void {
    this.$requestUpdate();
    this.live.refresh();
  }

  /** Draw the live tail again (its spinner, its clocks); the rest stays as drawn. */
  refreshLive(): void {
    this.live.refresh();
  }

  setSource(source: LineSource): void {
    this.source = source;
    this.top = 0;
    this.moved = false;
    this.refresh();
  }

  /** Show `source` from its top, following its end while `follow`; reaching the end follows again. */
  show(source: LineSource, follow: boolean): void {
    this.setSource(source);
    this.followable = true;
    this.follow = follow;
  }

  /** A press on line `index` at `column`: a `press` event with a `LinePress`, which bubbles to the owner's `@press=` (the mouse makes it; a test may). */
  press(index: number, column: number): void {
    this.$emit("press", new LinePress(index, column));
  }

  /** Drop the selection. */
  clearSelection(): void {
    if (!this.moved) return;
    this.moved = false;
    this.refresh();
  }

  /** Scroll by `delta` lines; scrolling up leaves follow mode, reaching the end re-enters it. */
  scroll(delta: number): void {
    const max = this.maxTop();
    const next = Math.max(0, Math.min(max, this.top + delta));
    if (delta < 0 && next < max) this.follow = false;
    if (next === max && this.followable) this.follow = true;
    if (next === this.top) return;
    this.top = next;
    this.refresh();
  }

  /** Show the lines from `top`, as a scroll would. */
  scrollTo(top: number): void {
    this.scroll(top - this.top);
  }

  /** Scroll half the viewport (at least a line), so the continuation of what was read stays in view. */
  page(direction: number): void {
    this.scroll(direction * Math.max(1, Math.floor(this.rows / 2)));
  }

  toTop(): void {
    this.follow = false;
    this.top = 0;
    this.refresh();
  }

  toEnd(): void {
    this.follow = this.followable;
    this.top = this.maxTop();
    this.refresh();
  }

  /** Scroll the least so line `index` shows; `center` puts it in the upper third. */
  reveal(index: number, center: boolean): void {
    const h = Math.max(1, this.rows);
    let next = this.top;
    if (center) next = index - Math.floor(h / 3);
    else if (index < this.top) next = index;
    else if (index >= this.top + h) next = index - h + 1;
    next = Math.max(0, Math.min(this.maxTop(), next));
    if (next === this.top) return;
    this.follow = false;
    this.top = next;
    this.refresh();
  }

  maxTop(): number {
    this.source.prepare(this.cols);
    return Math.max(0, this.source.count() - Math.max(1, this.rows));
  }

  /** The line a press at row `index` landed on (for owners that read its tag). */
  lineAt(index: number): Line | null {
    if (index < 0 || index >= this.source.count()) return null;
    return this.source.line(index, this.cols);
  }

  private measure(): void {
    const h = this.box.h;
    const w = Math.max(0, this.box.w - (this.fit ? 0 : 1));
    if (h === this.rows && w === this.cols) return;
    this.rows = h;
    this.cols = w;
    this.refresh();
  }

  private wheel(e: WheelEvent): void {
    e.consume();
    this.scroll(e.delta * 3);
  }

  private mouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.clearSelection();
    this.holding = true;
    this.pressX = e.x;
    this.pressY = e.y;
    this.pressRow = this.top + (e.y - this.box.y);
    const count = this.source.count();
    const below = this.pressRow >= count;
    this.fromRow = Math.max(0, Math.min(count - 1, this.pressRow));
    this.fromCell = below ? this.cols : Math.max(0, Math.min(this.cols, e.x - this.box.x));
    this.toRow = this.fromRow;
    this.toCell = this.fromCell;
  }

  private mouseMove(e: MouseEvent): void {
    if (!this.holding) return;
    if (e.y < this.box.y) this.scroll(-1);
    else if (e.y >= this.box.y + this.rows) this.scroll(1);
    const row = Math.max(0, Math.min(this.source.count() - 1, this.top + Math.max(0, Math.min(this.rows - 1, e.y - this.box.y))));
    const cell = Math.max(0, Math.min(this.cols, e.x - this.box.x));
    const moved = this.moved || e.x !== this.pressX || e.y !== this.pressY;
    if (row === this.toRow && cell === this.toCell && moved === this.moved) return;
    this.toRow = row;
    this.toCell = cell;
    this.moved = moved;
    this.refresh();
  }

  private mouseUp(e: MouseEvent): void {
    if (!this.holding) return;
    this.holding = false;
    this.mouseMove(e);
    if (!this.moved) {
      if (this.pressRow >= 0 && this.pressRow < this.source.count()) this.press(this.pressRow, this.fromCell);
      return;
    }
    if (this.source.count() === 0) return;
    const text = copyRows(this.source, this.startRow(), this.startCell(), this.endRow(), this.endCell(), this.cols);
    if (text.length > 0) this.$emit("copy", new LineCopy(text, this.endRow() - this.startRow() + 1));
  }

  private barPress(e: MouseEvent): void {
    if (e.button !== 0) return;
    const t = thumbOf(this.rows, this.source.count(), this.top);
    if (t.length === 0) return;
    const at = 2 * (e.y - this.box.y) + 1;
    this.grab = at >= t.start && at <= t.start + t.length ? at - t.start : Math.floor(t.length / 2);
    this.grabStart = t.start;
    this.grabTop = this.top;
    this.barDrag(e);
    this.refresh();
  }

  private barDrag(e: MouseEvent): void {
    if (this.grab < 0) return;
    const start = 2 * (e.y - this.box.y) + 1 - this.grab;
    this.scrollTo(start === this.grabStart ? this.grabTop : topAt(this.rows, this.source.count(), start));
  }

  private barRelease(e: MouseEvent): void {
    if (this.grab < 0) return;
    this.barDrag(e);
    this.grab = -1;
    this.refresh();
  }

  private forward(): boolean {
    return this.toRow > this.fromRow || (this.toRow === this.fromRow && this.toCell >= this.fromCell);
  }

  private startRow(): number {
    return this.forward() ? this.fromRow : this.toRow;
  }

  private startCell(): number {
    return this.forward() ? this.fromCell : this.toCell;
  }

  private endRow(): number {
    return this.forward() ? this.toRow : this.fromRow;
  }

  private endCell(): number {
    return (this.forward() ? this.toCell : this.fromCell) + 1;
  }

  private shown(index: number, line: Line): Line {
    if (!this.moved || index < this.startRow() || index > this.endRow()) return line;
    const l = new Line();
    l.bg = line.bg;
    l.runs = selectRuns(line, index === this.startRow() ? this.startCell() : 0, index === this.endRow() ? this.endCell() : -1);
    return l;
  }

  private window(): { top: number; end: number } {
    this.source.prepare(this.cols);
    if (this.fit) return { top: 0, end: this.source.count() };
    if (this.follow) this.top = this.maxTop();
    if (this.top > this.maxTop()) this.top = this.maxTop();
    return { top: this.top, end: Math.min(this.source.count(), this.top + Math.max(1, this.rows)) };
  }

  private liveLines(): Line[] {
    const { top, end } = this.window();
    const from = Math.max(top, Math.min(end, this.source.liveFrom()));
    const lines: Line[] = [];
    for (let i = from; i < end; i++) lines.push(this.shown(i, this.source.line(i, this.cols)));
    return lines;
  }

  override render(): unknown {
    const { top, end } = this.window();
    const count = this.source.count();
    const liveFrom = Math.max(top, Math.min(end, this.source.liveFrom()));
    const lines: Line[] = [];
    for (let i = top; i < liveFrom; i++) lines.push(this.shown(i, this.source.line(i, this.cols)));
    const now = Date.now();
    if (this.fit)
      return html`<div @mousedown=${(e: MouseEvent) => this.mouseDown(e)} @mousemove=${(e: MouseEvent) => this.mouseMove(e)} @mouseup=${(e: MouseEvent) => this.mouseUp(e)}>${lines.map((l) => lineTemplate(l, now))}${this.live}</div>`;
    const thumb = thumbOf(this.rows, count, top);
    const bar: Line[] = [];
    for (let i = 0; i < this.rows; i++) {
      const cell = new Line();
      const glyph = thumb.length > 0 ? barCell(thumb, i) : " ";
      cell.add(glyph, glyph === "│" ? this.trackFg : this.grab >= 0 ? this.heldFg : this.thumbFg);
      bar.push(cell);
    }
    return html`<div flex=1 direction="row" @wheel=${(e: WheelEvent) => this.wheel(e)}>
      <div flex=1 @mousedown=${(e: MouseEvent) => this.mouseDown(e)} @mousemove=${(e: MouseEvent) => this.mouseMove(e)} @mouseup=${(e: MouseEvent) => this.mouseUp(e)}>${lines.map((l) => lineTemplate(l, now))}${this.live}</div>
      <div width=1 @mousedown=${(e: MouseEvent) => this.barPress(e)} @mousemove=${(e: MouseEvent) => this.barDrag(e)} @mouseup=${(e: MouseEvent) => this.barRelease(e)}>${bar.map((l) => lineTemplate(l, now))}</div>
    </div>`;
  }
}
