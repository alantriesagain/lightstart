import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { configure, disposeTree, element, hasRootPart, html, key, nothing, render, svg, unsafeHTML } from "./core.js";
import { effect, signal } from "../signals/index.js";
import { hosts } from "./conformance-hosts.js";

for (const adapter of hosts)
  describe(`light/html on ${adapter.name}`, () => {
    /** @type {ReturnType<typeof adapter.host>} */
    let host;
    /** @type {unknown} */
    let container;
    const markup = () => adapter.markup(container);
    const text = () => adapter.text(container);
    const first = () => adapter.elements(container)[0];

    beforeEach(() => {
      host = adapter.host();
      configure({ host, effect });
      container = adapter.container();
    });

    afterEach(() => {
      disposeTree(container);
    });

    describe("child values", () => {
      it("renders strings, numbers and booleans as text", () => {
        render(html`${"a"}${1}${true}`, container);
        assert.equal(text(), "a1true");
      });

      it("clears on null, undefined and nothing", () => {
        for (const empty of [null, undefined, nothing]) {
          render(html`<p>${"x"}</p>`, container);
          assert.equal(text(), "x");
          render(html`<p>${empty}</p>`, container);
          assert.equal(text(), "");
        }
      });

      it("accepts null and nothing as the root value", () => {
        render(null, container);
        assert.equal(markup(), "");
        render(nothing, container);
        assert.equal(markup(), "");
      });

      it("reuses the elements of the same template across renders", () => {
        const tpl = (/** @type {string} */ v) => html`<p>${v}</p>`;
        render(tpl("a"), container);
        const p = first();
        render(tpl("b"), container);
        assert.equal(first(), p);
        assert.equal(text(), "b");
      });

      it("inserts host nodes directly", () => {
        const node = host.createElement("b");
        host.insertBefore(node, host.createText("bold"), null);
        render(html`<p>${node}</p>`, container);
        assert.equal(markup(), "<p><b>bold</b></p>");
      });

      it("renders nested templates and swaps branches cleanly", () => {
        const view = (/** @type {boolean} */ on) => html`<div>${on ? html`<i>on</i>` : html`<u>off</u>`}</div>`;
        render(view(true), container);
        assert.equal(markup(), "<div><i>on</i></div>");
        render(view(false), container);
        assert.equal(markup(), "<div><u>off</u></div>");
        render(view(true), container);
        assert.equal(markup(), "<div><i>on</i></div>");
      });

      it("stringifies unknown objects through the host", () => {
        render(html`${{ toString: () => "obj" }}`, container);
        assert.equal(text(), "obj");
      });

      it("renders a non-array iterable as a list", { skip: !adapter.iterables }, () => {
        render(html`<ul>${new Set([html`<li>a</li>`, html`<li>b</li>`])}</ul>`, container);
        assert.equal(markup(), "<ul><li>a</li><li>b</li></ul>");
      });
    });

    describe("attributes", () => {
      it("sets single-binding attributes and removes them on nothing", () => {
        render(html`<a href=${"/x"}></a>`, container);
        assert.equal(adapter.attribute(first(), "href"), "/x");
        render(html`<a href=${nothing}></a>`, container);
        assert.equal(adapter.attribute(first(), "href"), null);
      });

      it("renders null and undefined as an empty attribute (lit parity)", () => {
        render(html`<a title=${null}></a>`, container);
        assert.equal(adapter.attribute(first(), "title"), "");
        render(html`<a title=${undefined}></a>`, container);
        assert.equal(adapter.attribute(first(), "title"), "");
      });

      it("joins multi-binding attributes with their statics", () => {
        render(html`<p class="a ${"b"} c ${"d"}"></p>`, container);
        assert.equal(adapter.attribute(first(), "class"), "a b c d");
      });

      it("renders null and undefined as empty inside a composite, and drops the whole attribute on nothing", () => {
        render(html`<p class="a ${null} ${undefined}"></p>`, container);
        assert.equal(adapter.attribute(first(), "class"), "a  ");
        render(html`<p class="a ${nothing} b"></p>`, container);
        assert.equal(adapter.attribute(first(), "class"), null);
      });

      it("keeps static attributes on elements with bound attributes", () => {
        render(html`<p id="p" class=${"c"}></p>`, container);
        assert.equal(adapter.attribute(first(), "id"), "p");
        assert.equal(adapter.attribute(first(), "class"), "c");
      });

      it("supports unquoted attribute bindings", () => {
        render(html`<p class=${"c"}></p>`, container);
        assert.equal(adapter.attribute(first(), "class"), "c");
      });

      it("never parses attribute values as markup", () => {
        render(html`<p title=${"<b>&</b>"}></p>`, container);
        assert.equal(adapter.attribute(first(), "title"), "<b>&</b>");
        assert.equal(adapter.elements(container).length, 1);
      });
    });

    describe("properties and booleans", () => {
      it("assigns properties with the .prop syntax, preserving case", () => {
        render(html`<p .someValue=${42}></p>`, container);
        assert.equal(adapter.property(first(), "someValue"), 42);
      });

      it("does not treat a function property value as a thunk", () => {
        const fn = () => 1;
        render(html`<p .handler=${fn}></p>`, container);
        assert.equal(adapter.property(first(), "handler"), fn);
      });

      it("commits nothing as undefined", () => {
        render(html`<p .v=${1}></p>`, container);
        render(html`<p .v=${nothing}></p>`, container);
        assert.equal(adapter.property(first(), "v"), undefined);
      });

      it("toggles boolean attributes with the ?attr syntax", () => {
        render(html`<button ?disabled=${true}></button>`, container);
        assert.equal(adapter.attribute(first(), "disabled"), "");
        render(html`<button ?disabled=${false}></button>`, container);
        assert.equal(adapter.attribute(first(), "disabled"), null);
      });
    });

    describe("events", () => {
      it("invokes the current handler with the element as this", { skip: !adapter.handlerThis }, () => {
        /** @type {unknown[]} */
        const seen = [];
        render(html`<button @click=${/** @this {unknown} */ function (/** @type {unknown} */ e) { seen.push(this, e); }}></button>`, container);
        const event = { type: "click" };
        adapter.fire(first(), "click", event);
        assert.deepEqual(seen, [first(), event]);
      });

      it("invokes the current handler with the event", () => {
        /** @type {string[]} */
        const seen = [];
        render(html`<button @click=${(/** @type {{ type: string, detail: string }} */ e) => seen.push(`${e.type}:${e.detail}`)}></button>`, container);
        adapter.fire(first(), "click", { detail: "d" });
        assert.deepEqual(seen, ["click:d"]);
      });

      it("uses options.host as this when given", { skip: !adapter.handlerThis }, () => {
        const owner = {};
        /** @type {unknown[]} */
        const seen = [];
        render(html`<button @click=${/** @this {unknown} */ function () { seen.push(this); }}></button>`, container, { host: owner });
        adapter.fire(first(), "click", {});
        assert.deepEqual(seen, [owner]);
      });

      it("adds the listener once and swaps handlers without re-adding", () => {
        /** @type {string[]} */
        const seen = [];
        render(html`<button @click=${() => seen.push("a")}></button>`, container);
        render(html`<button @click=${() => seen.push("b")}></button>`, container);
        assert.equal(adapter.listenerCount(first(), "click"), 1);
        adapter.fire(first(), "click", {});
        assert.deepEqual(seen, ["b"]);
      });

      it("removes the listener on a nullish handler", () => {
        render(html`<button @click=${() => {}}></button>`, container);
        render(html`<button @click=${null}></button>`, container);
        assert.equal(adapter.listenerCount(first(), "click"), 0);
      });

      it("supports handleEvent objects and the once option", () => {
        let calls = 0;
        render(html`<button @click=${{ handleEvent: () => calls++, once: true }}></button>`, container);
        adapter.fire(first(), "click", {});
        adapter.fire(first(), "click", {});
        assert.equal(calls, 1);
      });
    });

    describe("lists", () => {
      it("index-diffs unkeyed arrays", () => {
        const view = (/** @type {string[]} */ items) => html`<ul>${items.map((v) => html`<li>${v}</li>`)}</ul>`;
        render(view(["a", "b"]), container);
        const [, li] = adapter.elements(container);
        render(view(["x", "y", "z"]), container);
        assert.equal(markup(), "<ul><li>x</li><li>y</li><li>z</li></ul>");
        assert.equal(adapter.elements(container)[1], li);
        render(view(["a"]), container);
        assert.equal(markup(), "<ul><li>a</li></ul>");
      });

      it("moves nodes on a keyed reorder instead of recreating them", () => {
        const view = (/** @type {string[]} */ keys) => html`<ul>${keys.map((k) => key(k, html`<li>${k}</li>`))}</ul>`;
        render(view(["a", "b", "c"]), container);
        const [, a, b, c] = adapter.elements(container);
        render(view(["c", "a", "b"]), container);
        assert.deepEqual(adapter.elements(container).slice(1), [c, a, b]);
        assert.equal(markup(), "<ul><li>c</li><li>a</li><li>b</li></ul>");
      });

      it("handles keyed insert and remove at the head, middle and tail", () => {
        const view = (/** @type {string[]} */ keys) => html`${keys.map((k) => key(k, html`<i>${k}</i>`))}`;
        render(view(["b", "d"]), container);
        const [b, d] = adapter.elements(container);
        render(view(["a", "b", "c", "d", "e"]), container);
        assert.equal(text(), "abcde");
        assert.equal(adapter.elements(container)[1], b);
        assert.equal(adapter.elements(container)[3], d);
        render(view(["b", "d"]), container);
        assert.equal(text(), "bd");
        assert.deepEqual(adapter.elements(container), [b, d]);
      });

      it("reverses a keyed list preserving identity", () => {
        const keys = ["1", "2", "3", "4", "5"];
        const view = (/** @type {string[]} */ ks) => html`${ks.map((k) => key(k, html`<i>${k}</i>`))}`;
        render(view(keys), container);
        const before = adapter.elements(container);
        render(view([...keys].reverse()), container);
        assert.deepEqual(adapter.elements(container), [...before].reverse());
        assert.equal(text(), "54321");
      });

      it("recreates a single keyed child on key change", () => {
        const view = (/** @type {string} */ k, /** @type {string} */ label) => html`${key(k, html`<i>${label}</i>`)}`;
        render(view("a", "a"), container);
        const a = first();
        render(view("a", "a2"), container);
        assert.equal(first(), a);
        assert.equal(text(), "a2");
        render(view("b", "b"), container);
        assert.notEqual(first(), a);
        assert.equal(text(), "b");
      });
    });

    describe("element()", () => {
      it("creates an element with attribute, property, boolean and event bindings", () => {
        let clicks = 0;
        render(element("button", { id: "b", ".value": 3, "?disabled": true, "@click": () => clicks++ }, "go"), container);
        assert.equal(markup(), '<button id="b" disabled="">go</button>');
        assert.equal(adapter.property(first(), "value"), 3);
        adapter.fire(first(), "click", {});
        assert.equal(clicks, 1);
      });

      it("diffs bindings in place for the same tag and removes the absent ones", () => {
        render(element("p", { id: "a", title: "t" }), container);
        const p = first();
        render(element("p", { id: "b" }), container);
        assert.equal(first(), p);
        assert.equal(adapter.attribute(p, "id"), "b");
        assert.equal(adapter.attribute(p, "title"), null);
      });

      it("recreates on tag change and calls ref with null on teardown", () => {
        /** @type {unknown[]} */
        const refs = [];
        render(element("p", { ref: (/** @type {unknown} */ el) => refs.push(el) }), container);
        const p = first();
        render(element("i", {}), container);
        assert.deepEqual(refs, [p, null]);
        assert.equal(adapter.tagOf(first()), "i");
      });

      it("renders nested content including templates", () => {
        render(element("div", {}, [html`<b>x</b>`, "y"]), container);
        assert.equal(markup(), "<div><b>x</b>y</div>");
      });

      it("rejects invalid tag names", () => {
        assert.throws(() => render(element("<x", {}), container));
      });
    });

    describe("unsafeHTML", () => {
      it("parses and inserts raw markup, deduping on the same string", () => {
        const view = (/** @type {string} */ raw) => html`<div>${unsafeHTML(raw)}</div>`;
        render(view("<i>a</i><b>b</b>"), container);
        assert.equal(markup(), "<div><i>a</i><b>b</b></div>");
        const [, i] = adapter.elements(container);
        render(view("<i>a</i><b>b</b>"), container);
        assert.equal(adapter.elements(container)[1], i);
        render(view("<u>c</u>"), container);
        assert.equal(markup(), "<div><u>c</u></div>");
      });

      it("treats null and nothing as empty", () => {
        render(html`<div>${unsafeHTML(null)}</div>`, container);
        assert.equal(markup(), "<div></div>");
      });

      it("never parses child text values as markup", () => {
        render(html`<div>${"<b>x</b>"}</div>`, container);
        assert.equal(adapter.elements(container).length, 1);
        assert.equal(text(), "<b>x</b>");
      });
    });

    describe("thunks", () => {
      it("evaluates a thunk once per render without an adapter", () => {
        configure({ host });
        let calls = 0;
        render(html`<span>${() => (calls++, "v")}</span>`, container);
        assert.equal(text(), "v");
        assert.equal(calls, 1);
      });

      it("updates child, attribute and boolean parts fine-grained", () => {
        const count = signal(0);
        const cls = signal("a");
        const on = signal(false);
        let renders = 0;
        const view = () => (renders++, html`<button class=${() => cls.value} ?disabled=${() => on.value}>${() => `n:${count.value}`}</button>`);
        render(view(), container);
        assert.equal(text(), "n:0");
        count.value = 5;
        cls.value = "b";
        on.value = true;
        assert.equal(text(), "n:5");
        assert.equal(adapter.attribute(first(), "class"), "b");
        assert.equal(adapter.attribute(first(), "disabled"), "");
        assert.equal(renders, 1);
      });

      it("swaps the effect when the thunk identity changes", () => {
        const a = signal("A");
        const b = signal("B");
        const view = (/** @type {typeof a} */ sig) => html`<span>${() => sig.value}</span>`;
        render(view(a), container);
        render(view(b), container);
        a.value = "A2";
        assert.equal(text(), "B");
        b.value = "B2";
        assert.equal(text(), "B2");
      });

      it("disposes effects when the part is cleared", () => {
        const count = signal(0);
        let evals = 0;
        render(html`<div>${html`<span>${() => (evals++, count.value)}</span>`}</div>`, container);
        render(html`<div>${null}</div>`, container);
        const before = evals;
        count.value = 99;
        assert.equal(evals, before);
      });

      it("self-disposes when its anchor left the tree", () => {
        const count = signal(0);
        let evals = 0;
        render(html`<span>${() => (evals++, count.value)}</span>`, container);
        count.value = 1;
        assert.equal(evals, 2);
        adapter.remove(first());
        count.value = 2;
        count.value = 3;
        assert.equal(evals, 2);
      });
    });

    describe("render root", () => {
      it("tracks root parts per container and leaves pre-existing children alone", () => {
        const other = adapter.container();
        host.insertBefore(other, host.createElement("hr"), null);
        render(html`<p>a</p>`, container);
        render(html`<p>b</p>`, other);
        assert.equal(adapter.markup(other), "<hr><p>b</p>");
        assert.equal(hasRootPart(container), true);
        disposeTree(other);
        assert.equal(hasRootPart(other), false);
      });

      it("renders svg templates", () => {
        render(svg`<circle r=${"2"}></circle>`, container);
        assert.equal(markup(), '<circle r="2"></circle>');
      });
    });
  });
