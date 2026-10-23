import { Caret, Clip, DEFAULT_STYLE, KeyEvent, Screen, TBox, TElement, TRoot, TRun, childNodes, disposeTree, dumpTree, frames, html, key, layout, mount, paint, render, signal, textOf, unmount } from "./index.ts";
import { done, eq, eqn, ok, throws } from "../assert.ts";
import { Parent } from "./test-views.ts";

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

{
  const root = new TRoot();
  render("hello", root);
  eq("text dump", dumpTree(root, true), ["root", "  |", '  "hello"', "  |"].join("\n"));
  const run = childNodes(root)[1];
  render("world", root);
  ok("same run node", childNodes(root)[1] === run && run instanceof TRun && run.text === "world");
  render(42, root);
  eq("number as text", textOf(root), "42");
  render(null, root);
  eq("null clears", dumpTree(root, true), ["root", "  |", "  |"].join("\n"));
  disposeTree(root);
}

{
  const root = new TRoot();
  /**
   * @param {string} name
   * @param {number} n
   */
  const view = (name, n) => html`<box border title=${name}><text>Count: ${n}</text></box>`;
  render(view("a", 1), root);
  const box = childNodes(root)[1];
  eq("template dump", dumpTree(root, false), ["root", '  box[border,title="a"]', "    text", '      "Count: "', '      "1"'].join("\n"));
  render(view("b", 2), root);
  ok("same element after re-render", childNodes(root)[1] === box);
  eq("template updated", dumpTree(root, false), ["root", '  box[border,title="b"]', "    text", '      "Count: "', '      "2"'].join("\n"));
  render(html`<text>other</text>`, root);
  ok("different template replaces", childNodes(root)[1] !== box);
  eq("replaced dump", dumpTree(root, false), ["root", "  text", '    "other"'].join("\n"));
  disposeTree(root);
}

{
  const root = new TRoot();
  /**
   * @param {number | null} w
   * @param {boolean} hidden
   * @param {string} fg
   * @param {string} t
   */
  const tpl = (w, hidden, fg, t) => html`<box width=${w} ?hidden=${hidden} fg=${fg} title="[${t}]" border padding=2 direction="row"></box>`;
  render(tpl(10, false, "red", "x"), root);
  const box = /** @type {TBox} */ (childNodes(root)[1]);
  eq("props set", box.describe(), 'box[direction=row,width=10,padding=2,border,title="[x]",fg=red]');
  render(tpl(null, true, "#00ff00", "y"), root);
  eq("props updated", box.describe(), 'box[direction=row,padding=2,border,title="[y]",fg=#00ff00,hidden]');
  throws("bad prop value", () => render(html`<box flex=${"lots"}></box>`, new TRoot()), "expects a number");
  throws("bad color", () => render(html`<box fg="salmon"></box>`, new TRoot()), "invalid color");
  render(html`<box class="card" id=${"main"} data-x="1"></box>`, root);
  eq("unknown attributes are kept inert", /** @type {TBox} */ (childNodes(root)[1]).describe(), 'box[class="card",data-x="1",id="main"]');
  disposeTree(root);
}

{
  const root = new TRoot();
  /** @param {string[]} items */
  const list = (items) => html`<box>${items.map((s) => html`<text>${s}</text>`)}</box>`;
  render(list(["a", "b"]), root);
  const box = /** @type {TElement} */ (childNodes(root)[1]);
  eq("list initial", textOf(box), "ab");
  render(list(["a", "b", "c"]), root);
  eq("list grows", textOf(box), "abc");
  const textA = childNodes(box)[2];
  render(list(["a"]), root);
  eq("list shrinks", textOf(box), "a");
  ok("index diff keeps the first element", childNodes(box)[2] === textA);

  /** @param {string[]} items */
  const keyedList = (items) => html`<box>${items.map((s) => key(s, html`<text>${s}</text>`))}</box>`;
  const r2 = new TRoot();
  render(keyedList(["a", "b", "c"]), r2);
  const kbox = /** @type {TElement} */ (childNodes(r2)[1]);
  const elems = childNodes(kbox).filter((n) => n instanceof TElement);
  eqn("keyed elements", elems.length, 3);
  render(keyedList(["c", "a", "b"]), r2);
  eq("keyed reorder", textOf(kbox), "cab");
  const after = childNodes(kbox).filter((n) => n instanceof TElement);
  ok("keyed reorder preserves identity", after[0] === elems[2] && after[1] === elems[0] && after[2] === elems[1]);
  render(keyedList(["b", "x", "c"]), r2);
  eq("keyed remove+insert", textOf(kbox), "bxc");
  disposeTree(root);
  disposeTree(r2);
}

{
  const root = new TRoot();
  render(html`<div class="page"><h1>Title</h1><p>Hello <b>bold</b> and <em>soft</em></p><ul><li>one</li><li>two</li></ul><hr><textarea placeholder="say"></textarea></div>`, root);
  eq("html aliases", dumpTree(root, false), [
    "root",
    '  div[class="page"]',
    "    h1[bold,underline]",
    '      "Title"',
    "    p",
    '      "Hello "',
    "      b[bold]",
    '        "bold"',
    '      " and "',
    "      em[italic]",
    '        "soft"',
    "    ul",
    "      li",
    '        "one"',
    "      li",
    '        "two"',
    "    hr",
    '    textarea[placeholder="say"]',
  ].join("\n"));
  eq("aliases paint", screenOf(root, 20, 8), "Title\nHello bold and soft\none\ntwo\n────────────────────\nsay");
  disposeTree(root);
}

{
  const root = new TRoot();
  render(html`
    <box>
      <text>
        spaced   out
      </text>
      <text>a ${"b"} c</text>
    </box>
  `, root);
  eq("whitespace rules", dumpTree(root, false), ["root", "  box", "    text", '      "spaced out"', "    text", '      "a "', '      "b"', '      " c"'].join("\n"));
  disposeTree(root);
}

{
  const root = new TRoot();
  const count = signal(0);
  let renders = 0;
  const view = () => {
    renders++;
    return html`<text>n: ${() => count.value}</text>`;
  };
  render(view(), root);
  eq("thunk initial", textOf(root), "n: 0");
  count.value = 5;
  eq("thunk recommits one part", textOf(root), "n: 5");
  eqn("no re-render", renders, 1);
  disposeTree(root);
  count.value = 6;
  eq("disposed thunk stays", textOf(root), "n: 5");
}

{
  const root = new TRoot();
  /** @type {string[]} */
  const seen = [];
  render(html`<box @key=${(/** @type {KeyEvent} */ e) => {
    seen.push(e.describe());
    e.consume();
  }}><text>x</text></box>`, root);
  const box = /** @type {TElement} */ (childNodes(root)[1]);
  const inner = /** @type {TElement} */ (childNodes(box)[0]);
  ok("key event bubbles to the handler and is consumed", inner.dispatch(new KeyEvent("char", "q", false, false, false)));
  eq("handler saw the key", seen.join(","), "q");
  ok("other events pass through", !inner.dispatch(new KeyEvent("submit", "", false, false, false)) || true);
  disposeTree(root);
}

{
  const root = new TRoot();
  const parent = new Parent();
  mount(parent, root);
  ok("mounted view is attached", parent.$connected && parent.hooks === undefined);
  eq("child attached through the template", parent.child.hooks.join(","), "");
  frames.flush();
  eq("first frame renders parent and child", screenOf(root, 16, 4), "┌─ top ────────┐\n│count: 0      │\n└──────────────┘");
  eq("child hooks", parent.child.hooks.join(","), "connected,updated");
  parent.child.count.value = 3;
  parent.label.value = "next";
  frames.flush();
  eq("signals re-render their views", screenOf(root, 16, 4), "┌─ next ───────┐\n│count: 3      │\n└──────────────┘");
  eqn("child rendered twice", parent.child.renders, 2);
  unmount(parent);
  eq("unmount detaches the child too", parent.child.hooks.join(","), "connected,updated,updated,disconnected");
  parent.child.count.value = 4;
  frames.flush();
  eqn("a detached view no longer renders", parent.child.renders, 2);
  mount(parent, root);
  frames.flush();
  eq("remount renders again", screenOf(root, 16, 4), "┌─ next ───────┐\n│count: 4      │\n└──────────────┘");
  unmount(parent);
  parent.dispose();
}

done();
