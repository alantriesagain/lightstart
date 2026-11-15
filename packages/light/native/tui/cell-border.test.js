import { ATTR_BOLD, Caret, Clip, DEFAULT_STYLE, Screen, TBox, TRoot, childNodes, html, layout, paint, parseColor, render, tabAt } from "./index.ts";
import { done, eq, eqn, ok } from "../assert.ts";

const OUTER = parseColor("#202020");
const INNER = parseColor("#101830");
const BLUE = parseColor("#7aa2f7");
const TAB_BG = parseColor("#334455");
const TAB_FG = parseColor("#eeeeee");

/** @param {import("./node.ts").TElement} el */
const firstBox = (el) => {
  for (const c of childNodes(el)) if (c instanceof TBox) return c;
  throw new Error("no box");
};

/** @param {TRoot} root @param {number} w @param {number} h */
const screenOf = (root, w, h) => {
  layout(root, w, h, DEFAULT_STYLE);
  const s = new Screen(w, h);
  paint(root, s, new Clip(0, 0, w, h), DEFAULT_STYLE, new Caret(), null);
  return s;
};

/** @param {Screen} s @param {number} x @param {number} y */
const at = (s, x, y) => s.styleAt(y * s.w + x);
/** @param {Screen} s @param {number} x @param {number} y */
const glyph = (s, x, y) => s.rowText(y, x, x + 1);

{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" width=10 height=5></box></box>`, root);
  const inner = firstBox(firstBox(root));
  const s = screenOf(root, 10, 5);
  eq("light top-left glyph", glyph(s, 0, 0), "▁");
  eq("light top-left fg", String(at(s, 0, 0).fg), String(BLUE));
  eq("light top-left bg", String(at(s, 0, 0).bg), String(OUTER));
  eq("light top-right glyph", glyph(s, 9, 0), "▁");
  eq("light top edge glyph", glyph(s, 4, 0), "▁");
  eq("light bottom-left glyph", glyph(s, 0, 4), "▔");
  eq("light bottom-left fg", String(at(s, 0, 4).fg), String(BLUE));
  eq("light bottom-left bg", String(at(s, 0, 4).bg), String(OUTER));
  eq("light bottom-right glyph", glyph(s, 9, 4), "▔");
  eq("light left edge glyph", glyph(s, 0, 2), "▏");
  eq("light left edge fg", String(at(s, 0, 2).fg), String(BLUE));
  eq("light left edge bg", String(at(s, 0, 2).bg), String(INNER));
  eq("light right edge glyph", glyph(s, 9, 2), "▕");
  eq("light right edge fg", String(at(s, 9, 2).fg), String(BLUE));
  eq("light right edge bg", String(at(s, 9, 2).bg), String(INNER));
  eq("light interior glyph", glyph(s, 4, 2), " ");
  eq("light interior bg", String(at(s, 4, 2).bg), String(INNER));
  eq("light top row keeps the outer bg", String(at(s, 4, 0).bg), String(OUTER));
  ok("cell border keeps the line style off the top corners", inner.borderStyle === "cell");
}

{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" borderHeavy width=6 height=4></box></box>`, root);
  const s = screenOf(root, 6, 4);
  eq("heavy top glyph", glyph(s, 2, 0), "▂");
  eq("heavy top fg", String(at(s, 2, 0).fg), String(BLUE));
  eq("heavy top bg", String(at(s, 2, 0).bg), String(OUTER));
  eq("heavy bottom glyph", glyph(s, 2, 3), "▆");
  eq("heavy bottom fg", String(at(s, 2, 3).fg), String(OUTER));
  eq("heavy bottom bg", String(at(s, 2, 3).bg), String(BLUE));
  eq("heavy left glyph", glyph(s, 0, 1), "▎");
  eq("heavy left fg", String(at(s, 0, 1).fg), String(BLUE));
  eq("heavy left bg", String(at(s, 0, 1).bg), String(INNER));
  eq("heavy right glyph", glyph(s, 5, 1), "▊");
  eq("heavy right fg", String(at(s, 5, 1).fg), String(INNER));
  eq("heavy right bg", String(at(s, 5, 1).bg), String(BLUE));
}

const tabs = "one\ntwo\nthree";
{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" width=22 height=6 tabs="${tabs}" activeTab=1 tabBg="#334455" tabFg="#eeeeee"><text>body</text></box></box>`, root);
  const inner = firstBox(firstBox(root));
  const s = screenOf(root, 22, 6);
  eq("the tabs side by side from the left edge, on the tab row", s.rowText(0), " one  two  three      ");
  const first = at(s, 1, 0);
  eq("an inactive tab is the line color", String(first.fg), String(BLUE));
  eq("on the outside's bg", String(first.bg), String(OUTER));
  ok("not bold", (first.attrs & ATTR_BOLD) === 0);
  eq("past the tabs the tab row is the outside's", String(at(s, 20, 0).bg), String(OUTER));
  const active = at(s, 6, 0);
  eq("active tab glyph", glyph(s, 6, 0), "t");
  eq("active tab fg", String(active.fg), String(TAB_FG));
  eq("active tab bg", String(active.bg), String(TAB_BG));
  ok("active tab bold", (active.attrs & ATTR_BOLD) !== 0);
  eq("under the tab row the edge: corners and the line, under the active tab too", s.rowText(1), "🭽▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔🭾");
  const lid = at(s, 2, 1);
  ok("the line is the line color over the tint", lid.fg === BLUE && lid.bg === INNER);
  eq("the sides start under the edge", glyph(s, 0, 2) + glyph(s, 21, 2), "▏▕");
  eq("the content starts under the edge", s.rowText(2, 1, 5), "body");
  eqn("tabAt first tab", tabAt(inner, 0), 0);
  eqn("tabAt first tab last cell", tabAt(inner, 4), 0);
  eqn("tabAt second tab", tabAt(inner, 5), 1);
  eqn("tabAt third tab", tabAt(inner, 16), 2);
  eqn("tabAt past the tabs", tabAt(inner, 17), -1);
  eqn("tabAt past the box", tabAt(inner, 30), -1);
}

{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" width=8 height=4 tabs="one\ntwo"></box></box>`, root);
  const inner = firstBox(firstBox(root));
  const s = screenOf(root, 8, 4);
  eq("a tab that does not fit is left out", s.rowText(0), " one    ");
  eqn("and is not pressed", tabAt(inner, 6), -1);
}

{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" width=12 height=4 tabs="one\ntwo\nthree" activeTab=2></box></box>`, root);
  const inner = firstBox(firstBox(root));
  const s = screenOf(root, 12, 4);
  eq("an active tab past the edge shows, the tabs before it dropped", s.rowText(0), " two  three ");
  eqn("tabAt answers the tab where it is drawn", tabAt(inner, 0), 1);
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" width=10 height=4 tabs="a\nb\nc\nd\ne" activeTab=4></box></box>`, root);
  const narrow = firstBox(firstBox(root));
  eq("as many tabs before it as fit", screenOf(root, 10, 4).rowText(0), " c  d  e  ");
  eqn("tabAt the first one drawn", tabAt(narrow, 0), 2);
}

{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" width=9 height=4 title="hello"></box></box>`, root);
  const inner = firstBox(firstBox(root));
  const s = screenOf(root, 9, 4);
  const active = at(s, 1, 0);
  eq("title fallback glyph", glyph(s, 1, 0), "h");
  eq("title fallback fg", String(active.fg), String(INNER));
  eq("title fallback bg", String(active.bg), String(BLUE));
  ok("title fallback is bold", (active.attrs & ATTR_BOLD) !== 0);
  eqn("title fallback tabAt", tabAt(inner, 1), 0);
}

{
  const root = new TRoot();
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830"><text>hi</text></box></box>`, root);
  layout(root, 10, 8, DEFAULT_STYLE);
  eqn("a box without tabs measures one row of border above, one below", firstBox(firstBox(root)).h, 3);
  render(html`<box bg="#202020"><box border borderStyle="cell" borderColor="#7aa2f7" bg="#101830" title="t"><text>hi</text></box></box>`, root);
  layout(root, 10, 8, DEFAULT_STYLE);
  eqn("with tabs, one more for the tab row", firstBox(firstBox(root)).h, 4);
}

done();
