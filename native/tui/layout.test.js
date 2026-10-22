import { Caret, Clip, DEFAULT_STYLE, Screen, Style, TBox, TInput, TRoot, TRun, TRUECOLOR_FLAG, TText, createElement, diffScreens, forgetLayout, layout, measure, paint, scrollStateOf, sgrTransition } from "./index.ts";
import { done, eq, eqn, ok } from "../assert.js";

/** @param {string} s */
const text = (s) => {
  const t = /** @type {TText} */ (createElement("text"));
  t.append(new TRun(s));
  return t;
};
const box = () => /** @type {TBox} */ (createElement("box"));
/** @param {TBox | TText | TInput} n */
const rect = (n) => String(n.x) + "," + String(n.y) + " " + String(n.w) + "x" + String(n.h);
/**
 * @param {TRoot} root
 * @param {number} w
 * @param {number} h
 * @param {TInput | null} focus
 */
const screenOf = (root, w, h, focus) => {
  layout(root, w, h, DEFAULT_STYLE);
  const s = new Screen(w, h);
  paint(root, s, new Clip(0, 0, w, h), DEFAULT_STYLE, new Caret(), focus);
  return s;
};

{
  const root = new TRoot();
  const header = text("Header");
  const body = box();
  body.flex = 1;
  const footer = text("Footer");
  root.append(header);
  root.append(body);
  root.append(footer);
  layout(root, 20, 10, DEFAULT_STYLE);
  eq("header", rect(header), "0,0 20x1");
  eq("body flex", rect(body), "0,1 20x8");
  eq("footer", rect(footer), "0,9 20x1");
}

{
  const root = new TRoot();
  const b = box();
  b.border = true;
  b.padding = 1;
  const t = text("the quick brown fox jumps over the lazy dog");
  b.append(t);
  root.append(b);
  layout(root, 20, 10, DEFAULT_STYLE);
  eq("bordered box", rect(b), "0,0 20x7");
  eq("inner text", rect(t), "2,2 16x3");
  const s = screenOf(root, 20, 10, null);
  eq("border row", s.rowText(0), "┌" + "─".repeat(18) + "┐");
  eq("text row", s.rowText(2), "│ the quick brown  │");
}

{
  const root = new TRoot();
  const row = box();
  row.direction = "row";
  row.gap = 1;
  row.flex = 1;
  const side = box();
  side.width = 5;
  const main = box();
  main.flex = 2;
  const other = box();
  other.flex = 1;
  row.append(side);
  row.append(main);
  row.append(other);
  root.append(row);
  layout(root, 23, 4, DEFAULT_STYLE);
  eq("side", rect(side), "0,0 5x4");
  eq("main", rect(main), "6,0 10x4");
  eq("other", rect(other), "17,0 5x4");
}

{
  const root = new TRoot();
  const log = box();
  log.flex = 1;
  log.scroll = true;
  log.stickToBottom = true;
  for (let i = 1; i <= 8; i++) log.append(text("line " + String(i)));
  const foot = text("foot");
  root.append(log);
  root.append(foot);
  let s = screenOf(root, 10, 4, null);
  eq("stick to bottom shows last lines", s.text(), "line 6\nline 7\nline 8\nfoot");
  eqn("scrollTop clamped to max", log.scrollTop, 5);
  log.scrollTop = 1;
  scrollStateOf(log).atBottom = false;
  s = screenOf(root, 10, 4, null);
  eq("explicit scrollTop", s.text(), "line 2\nline 3\nline 4\nfoot");
  log.append(text("line 9"));
  s = screenOf(root, 10, 4, null);
  eq("not at bottom: new content does not move the view", s.text(), "line 2\nline 3\nline 4\nfoot");
  log.scrollTop = 99;
  s = screenOf(root, 10, 4, null);
  eq("over-scroll clamps", s.text(), "line 7\nline 8\nline 9\nfoot");
  ok("back at bottom", scrollStateOf(log).atBottom);
}

{
  const root = new TRoot();
  const b = box();
  b.border = true;
  b.title = "Hi";
  const hidden = text("secret");
  hidden.hidden = true;
  b.append(hidden);
  b.append(text("ok"));
  root.append(b);
  const s = screenOf(root, 12, 5, null);
  eq("hidden skipped and title drawn", s.text(), "┌─ Hi ─────┐\n│ok        │\n└──────────┘");
}

{
  const root = new TRoot();
  const input = /** @type {TInput} */ (createElement("input"));
  input.placeholder = "type here";
  input.minLines = 1;
  input.maxLines = 3;
  root.append(input);
  root.append(text("after"));
  const s = screenOf(root, 12, 6, null);
  eq("placeholder when unfocused", s.text(), "type here\nafter");
  input.lines = ["hello world again", "x"];
  input.row = 1;
  input.col = 1;
  layout(root, 12, 6, DEFAULT_STYLE);
  eq("input grows with rows", rect(input), "0,0 12x3");
  const screen = new Screen(12, 6);
  const caret = new Caret();
  paint(root, screen, new Clip(0, 0, 12, 6), DEFAULT_STYLE, caret, input);
  eq("input text", screen.text(), "hello world\nagain\nx\nafter");
  eq("caret position", String(caret.x) + "," + String(caret.y), "1,2");
}

{
  const root = new TRoot();
  const rule = createElement("hr");
  root.append(text("above"));
  root.append(rule);
  root.append(text("below"));
  const s = screenOf(root, 6, 4, null);
  eq("hr paints a rule", s.text(), "above\n──────\nbelow");
}

{
  const front = new Screen(6, 2);
  const back = new Screen(6, 2);
  back.put(0, 0, "日", 2, DEFAULT_STYLE);
  back.put(2, 0, "a", 1, new Style(1, -1, 1));
  back.put(5, 1, "z", 1, DEFAULT_STYLE);
  const out = diffScreens(front, back);
  eq("diff stream", JSON.stringify(out), JSON.stringify("\x1b[?2026h\x1b[1;1H\x1b[0m日\x1b[1;31ma\x1b[2;6H\x1b[0mz\x1b[0m\x1b[?2026l"));
  eq("no-change diff", diffScreens(front, back), "");
  back.put(1, 0, "b", 1, DEFAULT_STYLE);
  eq("overwriting a wide right half blanks the left", back.rowText(0), " ba   ");
}

{
  const plain = DEFAULT_STYLE;
  const bold = new Style(-1, -1, 1);
  const boldRed = new Style(1, -1, 1);
  eq("from unknown", sgrTransition(null, boldRed), "\x1b[0;1;31m");
  eq("add color only", sgrTransition(bold, boldRed), "\x1b[31m");
  eq("remove attr resets", sgrTransition(boldRed, plain), "\x1b[0m");
  eq("same style", sgrTransition(bold, bold), "");
  eq("truecolor", sgrTransition(plain, new Style(0x1000000 | 0x1a2b3c, 2, 0)), "\x1b[38;2;26;43;60;42m");
}

{
  const root = new TRoot();
  const outer = box();
  const inner = text("hi");
  outer.append(inner);
  root.append(outer);
  const before = screenOf(root, 4, 1, null);
  outer.setKnownProp("bg", "#ffffff");
  const after = screenOf(root, 4, 1, null);
  eq("a text's lines, laid out once, follow the style its box takes later", String(before.bg[0]) + "|" + String(after.bg[0]), "-1|" + String(TRUECOLOR_FLAG | 0xffffff));
  outer.setKnownProp("bg", null);
  eq("and come back when the box drops it", String(screenOf(root, 4, 1, null).bg[0]), "-1");
}

{
  const root = new TRoot();
  const outer = box();
  const row = box();
  row.setOwnProp("direction", "row");
  const label = text("alpha beta");
  row.append(label);
  row.append(text("gamma"));
  outer.append(row);
  outer.append(text("delta epsilon zeta"));
  root.append(outer);
  const first = measure(outer, 30, DEFAULT_STYLE);
  ok("a box measured again at the same width answers its cached size", measure(outer, 30, DEFAULT_STYLE) === first);
  ok("and measured at another width, a new one", measure(outer, 8, DEFAULT_STYLE) !== first);
  const wide = measure(outer, 30, DEFAULT_STYLE);
  /** @type {TRun} */ (label.firstChild).setText("alpha beta and more words");
  const grown = measure(outer, 30, DEFAULT_STYLE);
  ok("a text changed beneath it measures it afresh", grown !== wide && grown.w > wide.w);
  layout(root, 30, 10, DEFAULT_STYLE);
  const cached = [outer, row, label].map(rect).join(" ");
  forgetLayout(root);
  layout(root, 30, 10, DEFAULT_STYLE);
  eq("a layout from the caches is the layout made afresh", [outer, row, label].map(rect).join(" "), cached);
}

done();
