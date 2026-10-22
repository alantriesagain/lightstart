/**
 * @file The windowed list: the scrollbar's thumb and track, a selection's
 * runs and the text a copy gives, and a `LineView` on a root: its lines leave
 * the last cell to the bar, it scrolls, pages and follows, a press is a
 * `press` event with the line and the column, a drag a `copy` event with the
 * text, `fit` draws every line and no bar, and a live run is drawn as the
 * spinner's frame.
 */
import { Caret, Clip, DEFAULT_STYLE, Line, MouseEvent, SPINNER, Screen, TElement, TRoot, Thumb, WheelEvent, barCell, copyRows, frames, hitTest, layout, mount, paint, selectRuns, sliceCells, thumbOf, topAt } from "./index.ts";
import { done, eq, ok } from "../assert.js";
import { Holder, Numbers, Rows } from "./test-lines.ts";

eq("every line fits: no thumb", String(thumbOf(10, 10, 0).length), "0");
const t = thumbOf(10, 100, 0);
eq("100 lines in 10 rows: a thumb of one row at the top", String(t.start) + ":" + String(t.length), "0:2");
eq("at the end, the thumb at the bottom", String(thumbOf(10, 100, 90).start), "18");
eq("and back: the thumb's places to the first line shown", [0, 9, 18, 40].map((s) => String(topAt(10, 100, s))).join(","), "0,45,90,90");
eq("the thumb never shorter than a row", String(thumbOf(10, 100000, 0).length), "2");
const half = new Thumb();
half.start = 1;
half.length = 2;
eq("a thumb starting halfway down a row", [0, 1, 2].map((r) => barCell(half, r)).join(""), "╽╿│");

const rows = new Rows();
rows.paragraph();
eq("copied whole: the prefix left out, the rows joined back, a cut word without a space", copyRows(rows, 0, 0, rows.count() - 1, -1, 16), "the quick brown foxjumps over");
eq("from the middle of a row to the middle of another", copyRows(rows, 0, 6, 1, 7, 16), "quick brown");
const l = new Line();
l.add("hello ", "");
l.add("world", "red");
eq("the selection drawn inverse on its cells", selectRuns(l, 3, 8).map((r) => (r.inverse ? "[" + r.text + "]" : r.text)).join(""), "hel[lo ][wo]rld");
eq("a run restyled keeps its style", l.runs[1].restyle("x").fg + l.runs[1].restyle("x").text, "redx");
eq("the cells of a text", sliceCells("abcdef", 2, 4), "cd");

const W = 20;
const H = 10;
const root = new TRoot();
const holder = new Holder();
const view = holder.view;
const source = new Numbers();
source.n = 5;
view.setSource(source);
mount(holder, root);
let painted = new Screen(W, H);
const screen = () => {
  for (let i = 0; i < 3; i++) {
    frames.flush();
    layout(root, W, H, DEFAULT_STYLE);
  }
  painted = new Screen(W, H);
  paint(root, painted, new Clip(0, 0, W, H), DEFAULT_STYLE, new Caret(), null);
  return painted.text().split("\n");
};
const bar = () => {
  screen();
  let s = "";
  for (let y = 0; y < H; y++) s += painted.rowText(y).slice(W - 1);
  return s;
};

screen();
eq("the lines leave the last cell to the bar", String(view.cols), String(W - 1));
eq("five lines in ten rows: no bar", bar(), " ".repeat(H));
source.n = 100;
view.refresh();
eq("a hundred: the thumb at the top of the track", bar(), "┃│││││││││");

/** @type {TElement | null} */
let held = null;
/** @param {TElement} el */
const attached = (el) => {
  /** @type {TElement | null} */
  let at = el;
  while (at !== null && at !== root) at = at.parent;
  return at === root;
};
/** @param {number} x @param {number} y */
const press = (x, y) => {
  const hit = hitTest(root, x, y);
  held = hit instanceof TElement ? hit : null;
  if (held !== null) held.dispatch(new MouseEvent("mousedown", x, y, 0, false, false, false));
  screen();
};
/** @param {string} type @param {number} x @param {number} y */
const move = (type, x, y) => {
  const el = held;
  if (el === null || !attached(el)) return false;
  el.dispatch(new MouseEvent(type, x, y, 0, false, false, false));
  screen();
  return true;
};

press(W - 1, H - 1);
eq("a press at the track's foot brings the thumb there", String(view.top) + " " + bar(), "90 │││││││││┃");
ok("the pressed cell is still on the screen after the scroll", move("mousemove", 3, 4));
eq("dragged up, off the bar: the lines follow the thumb", String(view.top) + " " + screen()[0].slice(0, W - 1).trim(), "40 line 40");
move("mouseup", 3, 4);
view.scrollTo(37);
const at = thumbOf(H, 100, 37);
press(W - 1, at.start >> 1);
move("mouseup", W - 1, at.start >> 1);
eq("a press on the thumb that does not move keeps the lines shown", String(view.top), "37");
hitTest(root, W - 1, 5)?.dispatch(new WheelEvent(W - 1, 5, 1, false, false, false));
screen();
eq("the wheel over the bar scrolls", String(view.top), "40");

view.followable = true;
view.toEnd();
screen();
ok("a followable view at its end follows", view.follow);
press(W - 1, 0);
eq("a press at the track's top leaves the end", String(view.top) + " " + String(view.follow), "0 false");
move("mousemove", W - 1, H - 1);
move("mouseup", W - 1, H - 1);
ok("dragged back to the end, it follows again", view.follow);
source.n = 120;
view.refresh();
screen();
eq("and new lines scroll into view", String(view.top), "110");
view.scrollTo(0);
view.page(1);
eq("a page scrolls half the viewport, so the continuation stays in view", String(view.top), String(Math.floor(H / 2)));
view.page(-1);
eq("and back up by the same half", String(view.top), "0");

view.scrollTo(5);
press(3, 2);
move("mouseup", 3, 2);
eq("a press that does not move is a press event with the line and the column", holder.presses.join(","), "7:3");
press(0, 1);
move("mousemove", 6, 2);
move("mouseup", 6, 2);
eq("a drag is a copy event with the text and the rows it spans", holder.copies.join("|"), "line 6\nline 7/2");
ok("the selection is drawn inverse", screen()[1].startsWith("line 6"));

const strip = new Holder();
const stripRoot = new TRoot();
const busy = new Numbers();
busy.n = 3;
busy.live = 2;
strip.view.fit = true;
strip.view.setSource(busy);
mount(strip, stripRoot);
for (let i = 0; i < 3; i++) {
  frames.flush();
  layout(stripRoot, W, H, DEFAULT_STYLE);
}
const stripScreen = new Screen(W, H);
paint(stripRoot, stripScreen, new Clip(0, 0, W, H), DEFAULT_STYLE, new Caret(), null);
eq("fit: the lines take the whole width, no bar", String(strip.view.cols), String(W));
eq("fit: every line drawn", stripScreen.rowText(0).trim() + "|" + stripScreen.rowText(1).trim() + "|" + stripScreen.rowText(3).trim(), "line 0|line 1|");
const live = stripScreen.rowText(2);
ok("a live run is drawn as the spinner's frame", SPINNER.includes(live.charAt(0)) && live.includes(" busy"));

done();
