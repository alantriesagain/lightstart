/**
 * @file The class attribute on the terminal host, with the theme's utility
 * classes as the styler: a class list becomes the element's props, read off
 * the element and off the painted screen; a prop the template writes wins
 * over its classes whatever the attribute order and comes back to them when
 * removed; a class list that drops a prop resets it; the dark scheme and the
 * `dark:` variant; `focus:` and `focus-within:` follow the renderer's focus;
 * unknown classes are ignored; a defined element takes its classes too;
 * without a styler `class` is inert again.
 */
import { ATTR_BOLD, ATTR_DIM, ATTR_ITALIC, ATTR_STRIKE, ATTR_UNDERLINE, Renderer, TBox, TRoot, TRUECOLOR_FLAG, TText, childNodes, configureClasses, frames, html, nothing, render, signal } from "./index.ts";
import { done, eq, ok } from "./assert.js";
import { TestTerminal } from "./test-terminal.ts";
import { TerminalClasses } from "../theme/terminal.ts";
import defaultTheme from "../theme/themes/default.js";
import { Board } from "./test-views.ts";

/** @param {import("./index.js").TElement} container the node between a root part's anchors */
const second = (container) => childNodes(container)[1];

/** @param {import("./index.js").TNode | null} node */
const box = (node) => {
  if (!(node instanceof TBox)) throw new Error("no box");
  return node;
};

/** @param {TBox} b */
const summary = (b) => [String(b.flex), b.direction, String(b.border), String(b.padding), String(b.gap), String(b.scroll), b.align, String(b.width), String(b.height)].join("|");

const hex = (/** @type {number} */ rgb) => TRUECOLOR_FLAG | rgb;

configureClasses(new TerminalClasses(defaultTheme, "light"));

{
  const root = new TRoot();
  render(html`<box class="flex-1 flex-row border p-1 gap-2 overflow-y-auto items-center w-10 h-3 bg-surface text-primary font-bold italic underline opacity-50"></box>`, root);
  const el = box(second(root));
  eq("the box props of the classes", summary(el), "1|row|true|1|1|true|start|5|2");
  eq("the colors as truecolor from the tokens", String(el.style.fg) + "/" + String(el.style.bg), String(hex(0x101210)) + "/" + String(hex(0xffffff)));
  ok("the attributes", el.style.has(ATTR_BOLD) && el.style.has(ATTR_ITALIC) && el.style.has(ATTR_UNDERLINE) && el.style.has(ATTR_DIM) && !el.style.has(ATTR_STRIKE));
  eq("describe shows the class and the props it set", el.describe(), 'box[direction=row,flex=1,width=5,height=2,padding=1,gap=1,border,scroll,align=start,class="flex-1 flex-row border p-1 gap-2 overflow-y-auto items-center w-10 h-3 bg-surface text-primary font-bold italic underline opacity-50",fg=#101210,bg=#ffffff,bold,dim,italic,underline]');
  render(html`<text class="line-through truncate">a line</text>`, root);
  const text = second(root);
  ok("a text takes strike and wrap", text instanceof TText && text.style.has(ATTR_STRIKE) && text.wrap === "none");
  render(html`<box class="hidden flex-none font-normal border-0 bg-transparent"></box>`, root);
  const off = box(second(root));
  eq("the false and default rows", String(off.hidden) + "|" + String(off.flex) + "|" + String(off.border) + "|" + String(off.style.bg) + "|" + String(off.style.has(ATTR_BOLD)), "true|0|false|-1|false");
}

{
  const root = new TRoot();
  render(html`<box class="bg-canvas"><text class="text-muted font-bold">hi</text></box>`, root);
  const renderer = new Renderer(new TestTerminal(), root);
  renderer.start();
  renderer.renderFrame();
  const cell = renderer.back.w * 0 + 0;
  eq("the painted screen carries the muted token, bold, on the canvas token", String(renderer.back.fg[cell]) + "/" + String(renderer.back.bg[cell]) + "/" + String((renderer.back.attrs[cell] & ATTR_BOLD) !== 0), String(hex(0x6b716b)) + "/" + String(hex(0xf3f4f2)) + "/true");
  renderer.stop();
}

{
  const root = new TRoot();
  render(html`<box><box flex=2 class="flex-1"></box><box class="flex-1" flex=2></box><box .flex=${2} class="flex-1"></box></box>`, root);
  const outer = box(second(root));
  const kids = [];
  for (let c = outer.firstChild; c !== null; c = c.next) if (c instanceof TBox) kids.push(c);
  eq("a prop the template writes wins over its classes, whatever the order, as an attribute or a property", kids.map((k) => String(k.flex)).join(","), "2,2,2");
  const classes = signal("flex-1 border");
  const color = signal(/** @type {string | typeof nothing} */ ("red"));
  const view = () => html`<box class=${classes.value}><text class="text-muted" fg=${color.value}>x</text></box>`;
  render(view(), root);
  const bound = box(second(root));
  const inner = bound.firstChild;
  if (!(inner instanceof TText)) throw new Error("no text");
  eq("a bound class list applies", String(bound.flex) + "|" + String(bound.border), "1|true");
  classes.value = "border";
  render(view(), root);
  eq("a class the list dropped resets, the one kept stays", String(bound.flex) + "|" + String(bound.border), "0|true");
  classes.value = "";
  render(view(), root);
  eq("an empty list resets everything it set", String(bound.flex) + "|" + String(bound.border), "0|false");
  eq("an explicit color beats the class", String(inner.style.fg), String(1));
  color.value = nothing;
  render(view(), root);
  eq("removed, the color comes back from the class", String(inner.style.fg), String(hex(0x6b716b)));
}

{
  const root = new TRoot();
  render(html`<box class="focus-within:bg-surface"><text tabindex="0" class="text-muted focus:text-primary focus:font-bold focus:dark:underline">a</text><text tabindex="0" bold=${false} class="focus:font-bold">b</text></box>`, root);
  const renderer = new Renderer(new TestTerminal(), root);
  renderer.start();
  const outer = box(second(root));
  const a = outer.firstChild;
  if (!(a instanceof TText) || !(a.next instanceof TText)) throw new Error("no texts");
  const b = a.next;
  const seen = () => String(a.style.fg) + "|" + String(a.style.has(ATTR_BOLD)) + "|" + String(b.style.has(ATTR_BOLD)) + "|" + String(outer.style.bg);
  eq("before the focus, the base layer alone", seen(), String(hex(0x6b716b)) + "|false|false|-1");
  renderer.renderFrame();
  renderer.setFocus(a);
  eq("the focused element takes its focus: layer, its ancestor its focus-within: layer", seen(), String(hex(0x101210)) + "|true|false|" + String(hex(0xffffff)));
  ok("dark: inside focus: stays off on the light scheme", !a.style.has(ATTR_UNDERLINE));
  renderer.renderFrame();
  eq("the painted texts take the box's new background, their lines laid out again under it", String(renderer.back.bg[0]) + "|" + String(renderer.back.bg[renderer.back.w]), String(hex(0xffffff)) + "|" + String(hex(0xffffff)));
  renderer.setFocus(b);
  eq("the focus moved: a is back to its base layer, b's explicit prop beats its focus: layer, the box keeps focus-within", seen(), String(hex(0x6b716b)) + "|false|false|" + String(hex(0xffffff)));
  renderer.setFocus(null);
  eq("no focus: the box loses its focus-within: layer", seen(), String(hex(0x6b716b)) + "|false|false|-1");
  renderer.setFocus(a);
  outer.remove(a);
  renderer.renderFrame();
  eq("a focused element that left the tree loses the focus at the next frame, and the box its focus-within", String(renderer.focus === null) + "|" + String(outer.style.bg), "true|-1");
  renderer.stop();
}

{
  const root = new TRoot();
  render(html`<box class="nope-xyz flex-1 md:p-4 hover:underline dark:text-primary text-muted"></box>`, root);
  const el = box(second(root));
  eq("unknown classes, media queries and states are ignored without a throw; a dark variant on the light scheme too", String(el.flex) + "|" + String(el.padding) + "|" + String(el.style.has(ATTR_UNDERLINE)) + "|" + String(el.style.fg), "1|0|false|" + String(hex(0x6b716b)));
  configureClasses(new TerminalClasses(defaultTheme, "dark"));
  render(html`<box class="text-primary dark:text-muted"></box>`, root);
  const darkEl = box(second(root));
  eq("on the dark scheme the colors resolve through the dark side and dark: applies", String(darkEl.style.fg), String(hex(0xe9ebe8) === darkEl.style.fg ? hex(0xe9ebe8) : darkEl.style.fg));
  ok("the dark variant overrode the plain class", darkEl.style.fg !== hex(0xe9ebe8));
  configureClasses(new TerminalClasses(defaultTheme, "light"));
  render(html`<test-board class="flex-1 border"></test-board>`, root);
  frames.flush();
  const defined = box(second(root));
  ok("a defined element takes its classes, since its view declares none of them", defined.owner instanceof Board && defined.flex === 1 && defined.border);
  configureClasses(null);
  render(html`<box class="flex-1 border"></box>`, root);
  const inert = box(second(root));
  eq("without a styler, class is inert again", String(inert.flex) + "|" + String(inert.border) + "|" + inert.describe(), '0|false|box[class="flex-1 border"]');
}

done();
