/**
 * @file Elements made by tag on the terminal host: a `define`d tag creates
 * its view's box; the tag's attributes and `.prop=` bindings reach the
 * view's declared props, typed; box props and inert attributes stay the
 * box's; the view renders in the frame after its parent and re-renders once
 * per change; `$emit` reaches a parent's handler; a removed element's view
 * is disposed with its thunks; a keyed list moves elements without remaking
 * them; `element()` builds a defined tag; the tag and prop names are
 * validated; a view the app constructs keeps today's contract.
 */
import { CustomEvent, TBox, TElement, TRoot, TRun, childNodes, define, element, frames, html, isDefinedTag, key, mount, render, textOf, unmount } from "./index.js";
import { done, eq, eqn, ok, throws } from "./assert.js";
import { Board, Emitter, Owner, Shell, tick } from "./test-views.ts";

/**
 * @param {import("./index.js").TNode} node
 * @param {TRun[]} out
 */
const runsOf = (node, out) => {
  if (node instanceof TRun) out.push(node);
  else if (node instanceof TElement) for (let c = node.firstChild; c !== null; c = c.next) runsOf(c, out);
  return out;
};

/** @param {TElement} container the node between a root part's anchors */
const second = (container) => childNodes(container)[1];

/** @param {unknown} el */
const boardOf = (el) => {
  const owner = el instanceof TBox ? el.owner : null;
  return owner instanceof Board ? owner : null;
};

/** @param {TBox} box */
const boardsIn = (box) => {
  /** @type {Board[]} */
  const out = [];
  for (let c = box.firstChild; c !== null; c = c.next) {
    const b = boardOf(c);
    if (b !== null) out.push(b);
  }
  return out;
};

{
  const root = new TRoot();
  const rowsAB = ["a", "b"];
  /**
   * @param {string[]} rows
   * @param {number | string} limit
   * @param {boolean} compact
   */
  const view = (rows, limit, compact) => html`<box><test-board .rows=${rows} filter="open" limit=${limit} ?compact=${compact} flex=1 border data-x="1"></test-board></box>`;
  render(view(rowsAB, 3, true), root);
  const el = second(root).firstChild;
  if (!(el instanceof TBox)) throw new Error("no element");
  eq("the tag made a box named by it", el.tag, "test-board");
  const board = boardOf(el);
  if (board === null) throw new Error("no board");
  eq("describe shows the box props and the inert attribute, not the declared props", el.describe(), 'test-board[flex=1,border,data-x="1"]');
  eq("the props hold their typed values before the first render", [board.rows.value.join(","), board.filter.value, typeof board.limit.value + ":" + String(board.limit.value), String(board.compact.value)].join("|"), "a,b|open|number:3|true");
  eq("connected ran, render has not", board.hooks.join(",") + "/" + String(board.renders), "connected/0");
  frames.flush();
  eqn("the first frame renders it once", board.renders, 1);
  eq("the hooks", board.hooks.join(","), "connected,updated");
  eq("its text", textOf(el), "open/3/compact: a,b tick 0");
  const rowsC = ["c"];
  render(view(rowsC, 3, true), root);
  frames.flush();
  eqn("a new array re-renders once", board.renders, 2);
  render(view(rowsC, 3, true), root);
  frames.flush();
  eqn("the same array does not", board.renders, 2);
  render(view(["d"], "7", false), root);
  frames.flush();
  eqn("two props changed at once render once", board.renders, 3);
  eq("a string attribute binding arrives as a number, the boolean as false", typeof board.limit.value + ":" + textOf(el), "number:open/7: d tick 0");
  tick.value = 1;
  frames.flush();
  eq("a thunk recommits its part without a render", textOf(el) + "/" + String(board.renders), "open/7: d tick 1/3");
  throws("a string that is not a number", () => board.$setProp("limit", "x"), "expects a number");
  ok("an undeclared name is not taken", !board.$setProp("nope", 1));
  const runs = runsOf(el, []);
  const before = runs.map((r) => r.text).join("");
  render(null, root);
  eq("removal disconnects and clears the element", board.hooks.join(",") + "/" + String(el.firstChild === null), "connected,updated,updated,updated,disconnected/true");
  tick.value = 2;
  frames.flush();
  eq("the disposed thunk no longer writes its run", runs.map((r) => r.text).join(""), before);
}

{
  const root = new TRoot();
  /** @type {string[]} */
  const fired = [];
  render(html`<box @picked=${(/** @type {CustomEvent} */ e) => fired.push("outer:" + String(e.detail))}><test-emitter @picked=${(/** @type {CustomEvent} */ e) => {
    fired.push("element:" + String(e.detail));
    if (e.detail === "stop") e.consume();
  }}></test-emitter></box>`, root);
  frames.flush();
  const el = second(root).firstChild;
  const owner = el instanceof TBox ? el.owner : null;
  const emitter = owner instanceof Emitter ? owner : null;
  if (emitter === null) throw new Error("no emitter");
  const first = emitter.fire("x");
  eq("the element's handler, then the outer box's", fired.join("|"), "element:x|outer:x");
  ok("the event answers itself: a CustomEvent of its type, not consumed", first instanceof CustomEvent && first.type === "picked" && !first.consumed);
  fired.length = 0;
  const stopped = emitter.fire("stop");
  eq("consume stops it at the element", fired.join("|") + "/" + String(stopped.consumed), "element:stop/true");
}

{
  const root = new TRoot();
  const rowsFor = new Map([["1", ["1"]], ["2", ["2"]], ["3", ["3"]]]);
  /** @param {string[]} ids */
  const list = (ids) => html`<box>${ids.map((id) => key(id, html`<test-board .rows=${rowsFor.get(id)}></test-board>`))}</box>`;
  render(list(["1", "2", "3"]), root);
  frames.flush();
  const box = second(root);
  if (!(box instanceof TBox)) throw new Error("no box");
  const [b1, b2, b3] = boardsIn(box);
  eq("three boards", String(boardsIn(box).length) + ":" + textOf(box), "3:all/10: 1 tick 2all/10: 2 tick 2all/10: 3 tick 2");
  render(list(["3", "1", "2"]), root);
  frames.flush();
  const after = boardsIn(box);
  ok("a reorder moves the same views", after[0] === b3 && after[1] === b1 && after[2] === b2);
  eq("without re-rendering or reconnecting them", [b1, b2, b3].map((b) => String(b.renders) + ":" + b.hooks.join(",")).join(" "), "1:connected,updated 1:connected,updated 1:connected,updated");
  render(list(["3", "1"]), root);
  frames.flush();
  eq("a dropped key disposes its own view only", [b1, b2, b3].map((b) => b.hooks[b.hooks.length - 1]).join(","), "updated,disconnected,updated");
  eqn("two left", boardsIn(box).length, 2);
}

{
  const root = new TRoot();
  render(html`<no-such-tag flex=1></no-such-tag>`, root);
  const el = second(root);
  ok("an undefined hyphenated tag is a plain box with no owner", el instanceof TBox && el.tag === "no-such-tag" && el.owner === null && el.flex === 1);
  ok("isDefinedTag", isDefinedTag("test-board") && !isDefinedTag("no-such-tag"));
  render(element("test-board", { ".rows": ["e"], limit: "4" }), root);
  frames.flush();
  eq("element() builds a defined tag too", textOf(root), "all/4: e tick 2");
  render(html`<test-board .rows=${["f"]}><text>child </text></test-board>`, root);
  frames.flush();
  eq("light children render above the content, unprojected until slots", textOf(root), "childall/10: f tick 2");
  throws("defining a tag twice", () => define("test-board", () => new Board()), "already defined");
  throws("a tag without a hyphen", () => define("plain", () => new Board()), "needs a hyphen");
  throws("an uppercase tag", () => define("test-Upper", () => new Board()), "lowercase");
  throws("a prop declared twice", () => new Board().prop("rows", []), "declared twice");
  throws("an uppercase prop name", () => new Board().prop("maxItems", 1), "lowercase");
}

{
  const root = new TRoot();
  const owner = new Owner();
  mount(owner, root);
  frames.flush();
  eq("a constructed board placed by value renders in its parent", textOf(root), "all/10:  tick 2");
  ok("its box keeps the view tag and the app owns it", owner.child.box.tag === "view" && !owner.child.$defined);
  unmount(owner);
  eq("unmounted, it keeps its content, as today", textOf(owner.child.box) + "/" + owner.child.hooks[owner.child.hooks.length - 1], "all/10:  tick 2/disconnected");
  const shell = new Shell();
  const other = new TRoot();
  mount(shell, other);
  frames.flush();
  eq("a view's template places a defined element", textOf(other), "open/3/compact: a,b tick 2");
  const inner = second(shell.box);
  if (!(inner instanceof TBox)) throw new Error("no inner box");
  const placed = inner.firstChild;
  const board = boardOf(placed);
  if (board === null || !(placed instanceof TBox)) throw new Error("no placed board");
  unmount(shell);
  eq("unmount clears the defined element inside and disconnects it", String(placed.firstChild === null) + "/" + board.hooks[board.hooks.length - 1], "true/disconnected");
  mount(shell, other);
  frames.flush();
  eq("remounted, the same view renders its content once", textOf(other) + "/" + String(boardOf(placed) === board), "open/3/compact: a,b tick 2/true");
}

done();
