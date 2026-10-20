/**
 * @file Slot projection on the terminal host: the children a template
 * writes inside a defined tag land in the `<slot>`s of the view's template.
 * A light child fills the default slot and parks the fallback; named and
 * unnamed children route in document order; the fallback shows while
 * nothing is slotted; a parent's binding inside slotted content keeps
 * updating and a keyed list reorders inside the slot; content survives the
 * view's template swap; a child naming a slot the render lacks waits
 * unpainted until that slot renders; a slotted view neither disconnects nor
 * reconnects; the outer of two nested default slots wins; a slot a thunk
 * renders later projects on its own; disposeTree returns the content; a slot
 * forwards through a nested host; slotchange fires once per change.
 */
import { Caret, Clip, DEFAULT_STYLE, Screen, TBox, TElement, TRoot, TText, childNodes, disposeTree, frames, html, key, layout, mount, paint, render, textOf } from "./index.ts";
import { done, eq, eqn, ok } from "./assert.js";
import { Grower, Later, Slotter, Swap, Watch } from "./test-views.ts";

/** @param {TElement} container the node between a root part's anchors */
const second = (container) => childNodes(container)[1];

/**
 * @param {import("./index.js").TNode} node
 * @param {string} tag
 * @returns {TElement | null}
 */
const findTag = (node, tag) => {
  if (!(node instanceof TElement)) return null;
  if (node.tag === tag) return node;
  for (let c = node.firstChild; c !== null; c = c.next) {
    const found = findTag(c, tag);
    if (found !== null) return found;
  }
  return null;
};

/**
 * @param {import("./index.js").TNode} node
 * @param {string} content
 * @returns {TText | null}
 */
const textWith = (node, content) => {
  if (node instanceof TText && textOf(node) === content) return node;
  if (!(node instanceof TElement)) return null;
  for (let c = node.firstChild; c !== null; c = c.next) {
    const found = textWith(c, content);
    if (found !== null) return found;
  }
  return null;
};

/**
 * @param {TRoot} root
 * @param {number} w
 * @param {number} h
 */
const screenOf = (root, w, h) => {
  layout(root, w, h, DEFAULT_STYLE);
  const s = new Screen(w, h);
  paint(root, s, new Clip(0, 0, w, h), DEFAULT_STYLE, new Caret(), null);
  return s.text();
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {import("./index.js").TNode | null} node */
const tagOf = (node) => (node instanceof TElement ? node.tag : "none");

{
  const root = new TRoot();
  render(html`<test-card><text>hi</text></test-card>`, root);
  frames.flush();
  eq("a light child lands in the default slot, the fallback parked", textOf(root), "hi");
  const slot = findTag(second(root), "slot");
  if (slot === null) throw new Error("no slot");
  eq("the slot holds it and says so", slot.describe() + "/" + textOf(slot), "slot[assigned]/hi");
}

{
  const root = new TRoot();
  render(html`<test-layout><text slot="head">H</text><text>B1</text><text>B2</text></test-layout>`, root);
  frames.flush();
  eq("named and unnamed children route to their slots in document order", textOf(root), "header:Hbody:B1B2");
}

{
  const root = new TRoot();
  render(html`<test-card></test-card>`, root);
  frames.flush();
  const slot = findTag(second(root), "slot");
  if (slot === null) throw new Error("no slot");
  eq("the fallback shows while nothing is slotted", textOf(root) + "/" + slot.describe(), "fallback/slot");
}

{
  const root = new TRoot();
  /**
   * @param {number} n
   * @param {string[]} ids
   */
  const view = (n, ids) => html`<test-card><text>${n}</text>${ids.map((id) => key(id, html`<text>${id}</text>`))}</test-card>`;
  render(view(1, ["a", "b", "c"]), root);
  frames.flush();
  eq("a binding and a keyed list inside the tag render in the slot", textOf(root), "1abc");
  const slot = findTag(second(root), "slot");
  if (slot === null) throw new Error("no slot");
  const a = textWith(slot, "a");
  const c = textWith(slot, "c");
  render(view(2, ["c", "a", "b"]), root);
  frames.flush();
  eq("the parent's binding keeps updating and the list reorders inside the slot", textOf(root), "2cab");
  ok("the same nodes moved, still in the slot", a !== null && c !== null && textWith(slot, "a") === a && textWith(slot, "c") === c && a.parent === slot);
}

{
  const root = new TRoot();
  render(html`<test-swap><text>kept</text></test-swap>`, root);
  frames.flush();
  const el = second(root);
  const owner = el instanceof TBox ? el.owner : null;
  const swap = owner instanceof Swap ? owner : null;
  if (swap === null) throw new Error("no swap");
  const kept = textWith(root, "kept");
  eq("the first template", textOf(root), "A:kept");
  swap.mode.value = "b";
  frames.flush();
  eq("slotted content survives the view's template swap", textOf(root), "B:kept");
  ok("as the same node", kept !== null && textWith(root, "kept") === kept && tagOf(kept.parent) === "slot");
}

{
  const root = new TRoot();
  render(html`<test-grower><text slot="side">S</text><text>main</text></test-grower>`, root);
  frames.flush();
  const el = second(root);
  const owner = el instanceof TBox ? el.owner : null;
  const grower = owner instanceof Grower ? owner : null;
  if (grower === null) throw new Error("no grower");
  const s = textWith(root, "S");
  if (s === null) throw new Error("no S");
  const holder = s.parent;
  ok("a child naming a slot the render lacks waits in a hidden unslotted box", holder instanceof TBox && holder.tag === "unslotted" && holder.hidden);
  const screen = screenOf(root, 20, 4);
  ok("unpainted, while the rest shows", screen.includes("main") && !screen.includes("S"));
  grower.more.value = true;
  await settle();
  eq("it moves into that slot when a thunk renders it, and the holder goes", tagOf(s.parent) + "/" + String(holder !== null && holder.parent === null) + "/" + textOf(root), "slot/true/mainS");
}

{
  const root = new TRoot();
  const slotter = new Slotter();
  mount(slotter, root);
  frames.flush();
  eq("a view placed inside the tag renders in the slot", textOf(root), "count: 0");
  eq("moved there without disconnecting or reconnecting", slotter.child.hooks.join(",") + "/" + tagOf(slotter.child.box.parent), "connected,updated/slot");
}

{
  const root = new TRoot();
  render(html`<test-nested><text>hi</text></test-nested>`, root);
  frames.flush();
  eq("the outer of two nested default slots gets the content", textOf(root), "hi");
}

{
  const root = new TRoot();
  render(html`<test-later><text>late</text></test-later>`, root);
  frames.flush();
  const el = second(root);
  const owner = el instanceof TBox ? el.owner : null;
  const later = owner instanceof Later ? owner : null;
  if (later === null) throw new Error("no later");
  eq("without a slot the child sits before the content", textOf(root), "latecontent");
  later.show.value = true;
  await settle();
  const late = textWith(root, "late");
  eq("a slot a thunk renders later projects without a host update", textOf(root) + "/" + (late === null ? "none" : tagOf(late.parent)), "contentlate/slot");
}

{
  const root = new TRoot();
  render(html`<test-card><text>back</text></test-card>`, root);
  frames.flush();
  const card = second(root);
  if (!(card instanceof TBox)) throw new Error("no card");
  const back = textWith(card, "back");
  const slot = findTag(card, "slot");
  if (back === null || slot === null) throw new Error("no content");
  disposeTree(card);
  eq("disposeTree returns the content to the light area and restores the fallback", String(back.parent === card) + "/" + textOf(slot) + "/" + slot.describe(), "true/fallback/slot");
}

{
  const root = new TRoot();
  render(html`<test-forward><text>deep</text></test-forward>`, root);
  frames.flush();
  const deep = textWith(root, "deep");
  eq("a slot forwards through a nested host", textOf(root) + "/" + (deep === null ? "none" : tagOf(deep.parent) + ">" + tagOf(deep.parent === null ? null : deep.parent.parent)), "deep/slot>slot");
}

{
  const root = new TRoot();
  render(html`<test-watch><text>w</text></test-watch>`, root);
  frames.flush();
  const el = second(root);
  const owner = el instanceof TBox ? el.owner : null;
  const watch = owner instanceof Watch ? owner : null;
  if (watch === null) throw new Error("no watch");
  eqn("slotchange fired once on the first projection", watch.changes, 1);
  watch.$project();
  eqn("a projection that changes nothing fires none", watch.changes, 1);
}

done();
