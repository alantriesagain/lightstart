/**
 * @file A line view's scrollbar: the thumb's place and length for a scroll position and back, in half
 * rows; painted in the view's last cell only while the lines overflow it. A press on the track brings the thumb there, a drag moves it (the
 * moves leaving the bar still its drag), a press that does not move keeps the lines shown, the
 * wheel scrolls over it, and in the chat a drag to the end follows new lines again.
 */
import { LineView } from "../line-view.ts";
import { Line, LineSource } from "@bootstrapp/light/native/tui/lines.ts";
import { Caret, Clip, DEFAULT_STYLE, MouseEvent, Screen, TElement, Thumb, TRoot, WheelEvent, barCell, frames, hitTest, layout, mount, paint, thumbOf, topAt } from "@bootstrapp/light/native/tui";
import { done, eq, ok } from "@light/test/assert.ts";

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

class Numbers extends LineSource {
  n = 0;
  count(): number {
    return this.n;
  }
  line(index: number, _width: number): Line {
    const l = new Line();
    l.add("line " + String(index), "");
    return l;
  }
}

const W = 20;
const H = 10;
const root = new TRoot();
const view = new LineView();
const source = new Numbers();
source.n = 5;
view.setSource(source);
mount(view, root);
let painted = new Screen(W, H);
const screen = (): string[] => {
  for (let i = 0; i < 3; i++) {
    frames.flush();
    layout(root, W, H, DEFAULT_STYLE);
  }
  painted = new Screen(W, H);
  paint(root, painted, new Clip(0, 0, W, H), DEFAULT_STYLE, new Caret(), null);
  return painted.text().split("\n");
};
const bar = (): string => {
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

/** The element under (x, y) gets the press; its moves and release go to it, as the renderer sends them. */
let held: TElement | null = null;
const attached = (el: TElement): boolean => {
  let at: TElement | null = el;
  while (at !== null && at !== root) at = at.parent;
  return at === root;
};
const press = (x: number, y: number): void => {
  const hit = hitTest(root, x, y);
  held = hit instanceof TElement ? hit : null;
  if (held !== null) held.dispatch(new MouseEvent("mousedown", x, y, 0, false, false, false));
  screen();
};
const move = (type: string, x: number, y: number): boolean => {
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
ok("the chat at its end follows", view.follow);
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
eq("a page key scrolls half the viewport, so the continuation stays in view", String(view.top), String(Math.floor(H / 2)));
view.page(1);
eq("and again", String(view.top), String(H));
view.page(-1);
eq("back up by the same half", String(view.top), String(Math.floor(H / 2)));

done();
