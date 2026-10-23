import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  configure,
  disposeTree,
  element,
  hasRootPart,
  html,
  key,
  nothing,
  projectSlots,
  render,
  svg,
  unsafeHTML,
} from "@bootstrapp/light/html";

if (typeof document === "undefined")
  throw new Error("document is not defined; browser-only suite, run with --browser");

const createEffectAdapter = () => {
  let currentEffect = null;
  const makeSignal = (value) => {
    const subscribers = new Set();
    return {
      get value() {
        if (currentEffect) {
          subscribers.add(currentEffect);
          currentEffect.deps.add(subscribers);
        }
        return value;
      },
      set value(next) {
        if (next === value) return;
        value = next;
        for (const eff of [...subscribers]) eff.run();
      },
    };
  };
  const effect = (fn) => {
    const eff = {
      deps: new Set(),
      disposed: false,
      run() {
        if (eff.disposed) return;
        for (const dep of eff.deps) dep.delete(eff);
        eff.deps.clear();
        const prev = currentEffect;
        currentEffect = eff;
        try {
          fn();
        } finally {
          currentEffect = prev;
        }
      },
      dispose() {
        eff.disposed = true;
        for (const dep of eff.deps) dep.delete(eff);
        eff.deps.clear();
      },
    };
    eff.run();
    return eff;
  };
  return { effect, signal: makeSignal };
};

describe("light/html", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    disposeTree(container);
    container.remove();
    configure({});
  });

  const textOf = () => container.textContent;

  describe("child values", () => {
    it("renders strings, numbers, and booleans as text", () => {
      render(html`<span>${"hi"} ${42} ${true}</span>`, container);
      assert.equal(container.querySelector("span").textContent, "hi 42 true");
    });

    it("clears on null, undefined, and nothing", () => {
      render(html`<span>${"content"}</span>`, container);
      assert.equal(textOf(), "content");
      render(html`<span>${null}</span>`, container);
      assert.equal(textOf(), "");
      render(html`<span>${"back"}</span>`, container);
      assert.equal(textOf(), "back");
      render(html`<span>${nothing}</span>`, container);
      assert.equal(textOf(), "");
      render(html`<span>${undefined}</span>`, container);
      assert.equal(textOf(), "");
    });

    it("accepts null and nothing as the root value", () => {
      render(null, container);
      assert.equal(textOf(), "");
      render(html`<b>x</b>`, container);
      assert.equal(textOf(), "x");
      render(nothing, container);
      assert.equal(textOf(), "");
    });

    it("reuses the same text node across re-renders", () => {
      const tpl = (v) => html`<span>${v}</span>`;
      render(tpl("a"), container);
      const node = container.querySelector("span").firstChild.nextSibling;
      assert.equal(node.nodeType, 3);
      render(tpl("b"), container);
      assert.equal(container.querySelector("span").firstChild.nextSibling, node);
      assert.equal(node.data, "b");
    });

    it("reuses elements across re-renders of the same template", () => {
      const tpl = (v) => html`<div id="stable">${v}</div>`;
      render(tpl(1), container);
      const el = container.querySelector("#stable");
      render(tpl(2), container);
      assert.equal(container.querySelector("#stable"), el);
      assert.equal(el.textContent, "2");
    });

    it("inserts DOM nodes directly", () => {
      const node = document.createElement("em");
      node.textContent = "raw";
      render(html`<div>${node}</div>`, container);
      assert.equal(container.querySelector("em"), node);
    });

    it("renders nested templates and swaps branches cleanly", () => {
      const a = (v) => html`<p class="a">${v}</p>`;
      const b = (v) => html`<section class="b">${v}</section>`;
      const outer = (inner) => html`<div>${inner}</div>`;
      render(outer(a("one")), container);
      assert.equal(container.querySelector("p.a").textContent, "one");
      const p = container.querySelector("p.a");
      render(outer(a("two")), container);
      assert.equal(container.querySelector("p.a"), p);
      assert.equal(p.textContent, "two");
      render(outer(b("three")), container);
      assert.equal(container.querySelector("p.a"), null);
      assert.equal(container.querySelector("section.b").textContent, "three");
    });

    it("stringifies unknown objects", () => {
      render(html`<span>${{ toString: () => "obj!" }}</span>`, container);
      assert.equal(textOf(), "obj!");
    });
  });

  describe("attributes", () => {
    it("sets single-binding attributes", () => {
      render(html`<div id=${"x"} title="${"t"}"></div>`, container);
      const el = container.querySelector("div");
      assert.equal(el.id, "x");
      assert.equal(el.getAttribute("title"), "t");
    });

    it("removes the attribute on nothing; null/undefined render empty (lit parity)", () => {
      const tpl = (v) => html`<div data-x=${v}></div>`;
      render(tpl("a"), container);
      const el = container.querySelector("div");
      assert.equal(el.getAttribute("data-x"), "a");
      render(tpl(nothing), container);
      assert.equal(el.hasAttribute("data-x"), false);
      render(tpl("b"), container);
      assert.equal(el.getAttribute("data-x"), "b");
      render(tpl(null), container);
      assert.equal(el.getAttribute("data-x"), "");
      render(tpl("c"), container);
      render(tpl(undefined), container);
      assert.equal(el.getAttribute("data-x"), "");
    });

    it("joins multi-binding attributes with statics", () => {
      const tpl = (a, b) => html`<div class="pre ${a} mid ${b} post"></div>`;
      render(tpl("A", "B"), container);
      const el = container.querySelector("div");
      assert.equal(el.getAttribute("class"), "pre A mid B post");
      render(tpl("C", "D"), container);
      assert.equal(el.getAttribute("class"), "pre C mid D post");
    });

    it("renders null/undefined as empty string in composite bindings", () => {
      render(html`<div class="a ${null} b ${undefined} c"></div>`, container);
      assert.equal(container.querySelector("div").getAttribute("class"), "a  b  c");
    });

    it("removes the whole composite attribute when any value is nothing", () => {
      const tpl = (v) => html`<div class="a ${v} b"></div>`;
      render(tpl("x"), container);
      const el = container.querySelector("div");
      assert.equal(el.getAttribute("class"), "a x b");
      render(tpl(nothing), container);
      assert.equal(el.hasAttribute("class"), false);
    });

    it("keeps static attributes on elements with bound attributes", () => {
      render(html`<div id="static" data-b=${"v"} role="note"></div>`, container);
      const el = container.querySelector("div");
      assert.equal(el.id, "static");
      assert.equal(el.getAttribute("role"), "note");
      assert.equal(el.getAttribute("data-b"), "v");
      assert.equal(el.hasAttribute("data-$$"), false);
    });

    it("supports unquoted attribute bindings", () => {
      render(html`<input type="text" value=${"abc"} />`, container);
      assert.equal(container.querySelector("input").getAttribute("value"), "abc");
    });
  });

  describe("properties", () => {
    it("assigns properties with .prop syntax preserving case", () => {
      render(html`<div .fooBar=${{ a: 1 }}></div>`, container);
      const el = container.querySelector("div");
      assert.deepEqual(el.fooBar, { a: 1 });
    });

    it("does not treat function property values as thunks", () => {
      const fn = () => "callback";
      render(html`<div .handler=${fn}></div>`, container);
      assert.equal(container.querySelector("div").handler, fn);
    });

    it("dedupes identical property commits", () => {
      const tpl = (v) => html`<i .tracked=${v}></i>`;
      const obj = { x: 1 };
      render(tpl(obj), container);
      const target = container.querySelector("i");
      let sets = 0;
      const current = target.tracked;
      Object.defineProperty(target, "tracked", {
        get: () => current,
        set: () => sets++,
        configurable: true,
      });
      render(tpl(obj), container);
      assert.equal(sets, 0);
      render(tpl({ x: 2 }), container);
      assert.equal(sets, 1);
    });

    it("commits nothing as undefined", () => {
      render(html`<div .value=${nothing}></div>`, container);
      assert.equal(container.querySelector("div").value, undefined);
    });

    it("sets .value on textarea", () => {
      render(html`<textarea .value=${"hello"}></textarea>`, container);
      assert.equal(container.querySelector("textarea").value, "hello");
    });
  });

  describe("boolean attributes", () => {
    it("toggles with ?attr syntax", () => {
      const tpl = (v) => html`<button ?disabled=${v}>go</button>`;
      render(tpl(true), container);
      const el = container.querySelector("button");
      assert.equal(el.hasAttribute("disabled"), true);
      render(tpl(false), container);
      assert.equal(el.hasAttribute("disabled"), false);
      render(tpl("truthy"), container);
      assert.equal(el.hasAttribute("disabled"), true);
      render(tpl(nothing), container);
      assert.equal(el.hasAttribute("disabled"), false);
    });
  });

  describe("events", () => {
    it("invokes the current handler with the element as this", () => {
      let received = null;
      let self = null;
      render(
        html`<button
          @click=${function (e) {
            received = e;
            self = this;
          }}
        >
          go
        </button>`,
        container,
      );
      const btn = container.querySelector("button");
      btn.click();
      assert.equal(received.type, "click");
      assert.equal(self, btn);
    });

    it("uses options.host as this when provided", () => {
      const host = { name: "host" };
      const local = document.createElement("div");
      document.body.appendChild(local);
      let self = null;
      render(
        html`<button
          @click=${function () {
            self = this;
          }}
        ></button>`,
        local,
        { host },
      );
      local.querySelector("button").click();
      assert.equal(self, host);
      disposeTree(local);
      local.remove();
    });

    it("adds the listener once and swaps handlers without re-adding", () => {
      const hits = [];
      const tpl = (h) => html`<button @click=${h}>x</button>`;
      render(tpl(() => hits.push(1)), container);
      const btn = container.querySelector("button");
      let adds = 0;
      const origAdd = btn.addEventListener.bind(btn);
      btn.addEventListener = (...args) => {
        adds++;
        origAdd(...args);
      };
      render(tpl(() => hits.push(2)), container);
      render(tpl(() => hits.push(3)), container);
      btn.click();
      assert.deepEqual(hits, [3]);
      assert.equal(adds, 0);
    });

    it("removes the listener on nullish handler", () => {
      let hits = 0;
      const tpl = (h) => html`<button @click=${h}>x</button>`;
      render(tpl(() => hits++), container);
      const btn = container.querySelector("button");
      btn.click();
      assert.equal(hits, 1);
      render(tpl(null), container);
      btn.click();
      assert.equal(hits, 1);
    });

    it("supports handleEvent objects", () => {
      let hits = 0;
      render(html`<button @click=${{ handleEvent: () => hits++ }}>x</button>`, container);
      container.querySelector("button").click();
      assert.equal(hits, 1);
    });

    it("supports once option", () => {
      let hits = 0;
      render(html`<button @click=${{ handleEvent: () => hits++, once: true }}>x</button>`, container);
      const btn = container.querySelector("button");
      btn.click();
      btn.click();
      assert.equal(hits, 1);
    });
  });

  describe("lists", () => {
    it("renders and index-diffs unkeyed arrays", () => {
      const tpl = (items) => html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
      render(tpl(["a", "b", "c"]), container);
      assert.equal(container.querySelectorAll("li").length, 3);
      assert.equal(textOf(), "abc");
      render(tpl(["a", "z"]), container);
      assert.equal(container.querySelectorAll("li").length, 2);
      assert.equal(textOf(), "az");
      render(tpl(["a", "z", "q", "w"]), container);
      assert.equal(textOf(), "azqw");
    });

    it("moves DOM on keyed reorder instead of recreating", () => {
      const tpl = (items) => html`<ul>${items.map((i) => key(i, html`<li id="k${i}">${i}</li>`))}</ul>`;
      render(tpl([1, 2, 3]), container);
      const one = container.querySelector("#k1");
      const two = container.querySelector("#k2");
      const three = container.querySelector("#k3");
      render(tpl([3, 1, 2]), container);
      assert.equal(container.querySelector("#k1"), one);
      assert.equal(container.querySelector("#k2"), two);
      assert.equal(container.querySelector("#k3"), three);
      assert.equal(
        [...container.querySelectorAll("li")].map((li) => li.textContent).join(""),
        "312",
      );
    });

    it("preserves input value and identity across a full keyed reverse", () => {
      const tpl = (items) =>
        html`<div>${items.map((i) => key(i, html`<input id="in${i}" />`))}</div>`;
      render(tpl([1, 2, 3]), container);
      const target = container.querySelector("#in2");
      target.value = "typed";
      render(tpl([3, 2, 1]), container);
      assert.equal(container.querySelector("#in2"), target);
      assert.equal(target.value, "typed");
    });

    it("preserves focus and selection when the focused item does not move", () => {
      const tpl = (items) =>
        html`<div>${items.map((i) => key(i, html`<input id="in${i}" />`))}</div>`;
      render(tpl([1, 2, 3]), container);
      const target = container.querySelector("#in2");
      target.value = "typed";
      target.focus();
      target.setSelectionRange(1, 3);
      render(tpl([3, 1, 2]), container);
      assert.equal(container.querySelector("#in2"), target);
      assert.equal(document.activeElement, target);
      assert.equal(target.selectionStart, 1);
      assert.equal(target.selectionEnd, 3);
    });

    it("handles keyed insert and remove at head, middle, and tail", () => {
      const tpl = (items) => html`<ol>${items.map((i) => key(i, html`<li>${i}</li>`))}</ol>`;
      render(tpl(["b", "d"]), container);
      render(tpl(["a", "b", "c", "d", "e"]), container);
      assert.equal(textOf(), "abcde");
      render(tpl(["b", "d"]), container);
      assert.equal(textOf(), "bd");
      render(tpl([]), container);
      assert.equal(textOf(), "");
      render(tpl(["z"]), container);
      assert.equal(textOf(), "z");
    });

    it("reverses a keyed list preserving element identity", () => {
      const tpl = (items) => html`<ul>${items.map((i) => key(i, html`<li id="r${i}">${i}</li>`))}</ul>`;
      render(tpl([1, 2, 3, 4, 5]), container);
      const refs = [...container.querySelectorAll("li")];
      render(tpl([5, 4, 3, 2, 1]), container);
      const after = [...container.querySelectorAll("li")];
      assert.deepEqual(after.map((el) => el.id), ["r5", "r4", "r3", "r2", "r1"]);
      assert.equal(after[0], refs[4]);
      assert.equal(after[4], refs[0]);
    });

    it("supports a single keyed child that recreates on key change", () => {
      const tpl = (k) => html`<div>${key(k, html`<p>page ${k}</p>`)}</div>`;
      render(tpl("a"), container);
      const p1 = container.querySelector("p");
      render(tpl("a"), container);
      assert.equal(container.querySelector("p"), p1);
      render(tpl("b"), container);
      assert.notEqual(container.querySelector("p"), p1);
      assert.equal(textOf(), "page b");
    });
  });

  describe("parse contexts", () => {
    it("renders bindings inside table structures", () => {
      const tpl = (rows) =>
        html`<table>
          <tbody>
            ${rows.map((r) => html`<tr><td>${r}</td></tr>`)}
          </tbody>
        </table>`;
      render(tpl(["r1", "r2"]), container);
      const cells = container.querySelectorAll("table tbody tr td");
      assert.equal(cells.length, 2);
      assert.equal(cells[0].textContent, "r1");
      assert.equal(container.querySelector("table tbody tr").parentElement.tagName, "TBODY");
    });

    it("renders select options with bound selection", () => {
      const tpl = (sel) =>
        html`<select .value=${sel}>
          <option value="a">A</option>
          <option value="b">B</option>
        </select>`;
      render(tpl("b"), container);
      assert.equal(container.querySelector("select").value, "b");
    });

    it("creates svg-namespaced nodes from svg templates", () => {
      render(html`<svg viewBox="0 0 10 10">${svg`<circle cx=${5} cy="5" r="4"></circle>`}</svg>`, container);
      const circle = container.querySelector("circle");
      assert.equal(circle.namespaceURI, "http://www.w3.org/2000/svg");
      assert.equal(circle.getAttribute("cx"), "5");
    });

    it("errors on a partial-content textarea binding", () => {
      let threw = null;
      try {
        render(html`<textarea>pre ${"x"}</textarea>`, container);
      } catch (e) {
        threw = e;
      }
      assert(threw !== null, "expected a parse error");
      assert(threw.message.includes("entire content"), threw.message);
    });

    it("errors on dynamic tag names pointing at element()", () => {
      const strings = Object.assign(["<", "></div>"], { raw: ["<", "></div>"] });
      let threw = null;
      try {
        render(html(strings, "div"), container);
      } catch (e) {
        threw = e;
      }
      assert(threw !== null, "expected a parse error");
      assert(threw.message.includes("element("), threw.message);
    });

    it("errors on bindings inside comments", () => {
      const strings = Object.assign(["<!-- ", " -->"], { raw: ["<!-- ", " -->"] });
      let threw = null;
      try {
        render(html(strings, "x"), container);
      } catch (e) {
        threw = e;
      }
      assert(threw !== null, "expected a parse error");
    });
  });

  describe("element()", () => {
    it("creates an element with attribute, property, boolean, and event bindings", () => {
      let hits = 0;
      render(
        html`<div>${element("button", {
          class: "btn",
          ".payload": { id: 7 },
          "?disabled": false,
          "@click": () => hits++,
        }, "press")}</div>`,
        container,
      );
      const btn = container.querySelector("button");
      assert.equal(btn.getAttribute("class"), "btn");
      assert.deepEqual(btn.payload, { id: 7 });
      assert.equal(btn.hasAttribute("disabled"), false);
      assert.equal(btn.textContent, "press");
      btn.click();
      assert.equal(hits, 1);
    });

    it("diffs bindings in place for the same tag", () => {
      const tpl = (cls, dis) => html`<div>${element("button", { class: cls, "?disabled": dis })}</div>`;
      render(tpl("a", false), container);
      const btn = container.querySelector("button");
      render(tpl("b", true), container);
      assert.equal(container.querySelector("button"), btn);
      assert.equal(btn.getAttribute("class"), "b");
      assert.equal(btn.hasAttribute("disabled"), true);
    });

    it("removes bindings absent from the next render", () => {
      const tpl = (bindings) => html`<div>${element("i", bindings)}</div>`;
      render(tpl({ class: "x", "data-y": "z" }), container);
      const el = container.querySelector("i");
      assert.equal(el.getAttribute("data-y"), "z");
      render(tpl({ class: "x" }), container);
      assert.equal(el.hasAttribute("data-y"), false);
      assert.equal(el.getAttribute("class"), "x");
    });

    it("recreates on tag change and calls ref with null on teardown", () => {
      const refs = [];
      const tpl = (tag) => html`<div>${element(tag, { ref: (el) => refs.push(el) })}</div>`;
      render(tpl("span"), container);
      assert.equal(refs.length, 1);
      assert.equal(refs[0].tagName, "SPAN");
      render(tpl("em"), container);
      assert.equal(refs.length, 3);
      assert.equal(refs[1], null);
      assert.equal(refs[2].tagName, "EM");
    });

    it("renders nested content including templates", () => {
      render(
        html`<div>${element("section", {}, html`<h2>${"title"}</h2>`)}</div>`,
        container,
      );
      assert.equal(container.querySelector("section h2").textContent, "title");
    });

    it("rejects invalid tag names", () => {
      let threw = null;
      try {
        render(html`<div>${element("scr ipt><img", {})}</div>`, container);
      } catch (e) {
        threw = e;
      }
      assert(threw !== null, "expected a tag validation error");
    });

    it("renders custom element tags with dashes", () => {
      render(html`<div>${element("my-widget", { ".component": "x" })}</div>`, container);
      const el = container.querySelector("my-widget");
      assert.equal(el.component, "x");
    });
  });

  describe("unsafeHTML", () => {
    it("parses and inserts raw markup", () => {
      render(html`<div>${unsafeHTML("<b>bold</b> <i>italic</i>")}</div>`, container);
      assert.equal(container.querySelector("b").textContent, "bold");
      assert.equal(container.querySelector("i").textContent, "italic");
    });

    it("dedupes on the same string and replaces on change", () => {
      const tpl = (s) => html`<div>${unsafeHTML(s)}</div>`;
      render(tpl("<b>one</b>"), container);
      const b = container.querySelector("b");
      render(tpl("<b>one</b>"), container);
      assert.equal(container.querySelector("b"), b);
      render(tpl("<b>two</b>"), container);
      assert.equal(container.querySelector("b").textContent, "two");
    });

    it("treats null and nothing as empty", () => {
      render(html`<div>${unsafeHTML(null)}</div>`, container);
      assert.equal(textOf(), "");
    });
  });

  describe("security", () => {
    it("never parses child text values as HTML", () => {
      render(html`<div>${"<img src=x onerror=hit()>"}</div>`, container);
      assert.equal(container.querySelector("img"), null);
      assert(textOf().includes("<img"), "markup rendered as text");
    });

    it("never parses attribute values as HTML", () => {
      render(html`<div title=${'"><img src=x>'}></div>`, container);
      assert.equal(container.querySelector("img"), null);
      assert.equal(container.querySelector("div").getAttribute("title"), '"><img src=x>');
    });
  });

  describe("thunks", () => {
    it("evaluates thunks once per render without an adapter", () => {
      let calls = 0;
      const tpl = () => html`<span>${() => (calls++, "v")}</span>`;
      render(tpl(), container);
      assert.equal(textOf(), "v");
      assert.equal(calls, 1);
    });

    it("updates a child part fine-grained via the effect adapter", () => {
      const { effect, signal } = createEffectAdapter();
      configure({ effect });
      const count = signal(0);
      let renders = 0;
      const tpl = () => (renders++, html`<span>${() => `n:${count.value}`}</span>`);
      render(tpl(), container);
      assert.equal(textOf(), "n:0");
      count.value = 5;
      assert.equal(textOf(), "n:5");
      assert.equal(renders, 1);
    });

    it("updates attribute and boolean parts fine-grained", () => {
      const { effect, signal } = createEffectAdapter();
      configure({ effect });
      const cls = signal("a");
      const dis = signal(false);
      render(html`<button class=${() => cls.value} ?disabled=${() => dis.value}></button>`, container);
      const btn = container.querySelector("button");
      assert.equal(btn.getAttribute("class"), "a");
      cls.value = "b";
      dis.value = true;
      assert.equal(btn.getAttribute("class"), "b");
      assert.equal(btn.hasAttribute("disabled"), true);
    });

    it("swaps the effect when the thunk identity changes", () => {
      const { effect, signal } = createEffectAdapter();
      configure({ effect });
      const a = signal("A");
      const b = signal("B");
      const tpl = (sig) => html`<span>${() => sig.value}</span>`;
      render(tpl(a), container);
      assert.equal(textOf(), "A");
      render(tpl(b), container);
      assert.equal(textOf(), "B");
      a.value = "A2";
      assert.equal(textOf(), "B");
      b.value = "B2";
      assert.equal(textOf(), "B2");
    });

    it("disposes effects when the part is cleared", () => {
      const { effect, signal } = createEffectAdapter();
      configure({ effect });
      const count = signal(0);
      let evals = 0;
      render(html`<div>${html`<span>${() => (evals++, count.value)}</span>`}</div>`, container);
      assert.equal(evals, 1);
      render(html`<div>${null}</div>`, container);
      const before = evals;
      count.value = 99;
      assert.equal(evals, before);
    });

    it("self-disposes when the anchor left the document", () => {
      const { effect, signal } = createEffectAdapter();
      configure({ effect });
      const count = signal(0);
      let evals = 0;
      const local = document.createElement("div");
      document.body.appendChild(local);
      render(html`<span>${() => (evals++, count.value)}</span>`, local);
      count.value = 1;
      assert.equal(evals, 2);
      local.remove();
      count.value = 2;
      count.value = 3;
      assert.equal(evals, 2);
      disposeTree(local);
    });
  });

  describe("render root", () => {
    it("tracks root parts per container", () => {
      assert.equal(hasRootPart(container), false);
      render(html`<b>x</b>`, container);
      assert.equal(hasRootPart(container), true);
      const other = document.createElement("div");
      assert.equal(hasRootPart(other), false);
    });

    it("renders into a shadow root", () => {
      const hostEl = document.createElement("div");
      document.body.appendChild(hostEl);
      const shadow = hostEl.attachShadow({ mode: "open" });
      render(html`<p>${"shadow"}</p>`, shadow);
      assert.equal(shadow.querySelector("p").textContent, "shadow");
      disposeTree(shadow);
      hostEl.remove();
    });

    it("leaves pre-existing container children alone", () => {
      const local = document.createElement("div");
      local.innerHTML = "<b>keep</b>";
      document.body.appendChild(local);
      render(html`<i>new</i>`, local);
      assert.equal(local.querySelector("b").textContent, "keep");
      assert.equal(local.querySelector("i").textContent, "new");
      disposeTree(local);
      local.remove();
    });
  });
});

describe("light/html - detaching", () => {
  it("removes a node that overrides its own remove()", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const el = document.createElement("div");
    el.remove = () => {};
    render(el, container);
    assert.equal(container.querySelector("div"), el);
    render(null, container);
    assert.equal(container.querySelector("div"), null);
    container.remove();
  });
});

describe("light/html - slots", () => {
  it("renders a slot with its static attributes and fallback when no host projects", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(html`<slot name="a" class="x">fb</slot>`, container);
    const slot = container.querySelector("slot");
    assert.equal(slot.getAttribute("name"), "a");
    assert.equal(slot.className, "x");
    assert.equal(slot.textContent, "fb");
    assert.equal(slot.hasAttribute("data-assigned"), false);
    container.remove();
  });

  it("commits bound attributes on a slot element", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const tpl = (name, cls) => html`<slot name=${name} class=${cls}></slot>`;
    render(tpl("a", "one"), container);
    const slot = container.querySelector("slot");
    assert.equal(slot.getAttribute("name"), "a");
    assert.equal(slot.className, "one");
    render(tpl("b", "two"), container);
    assert.equal(container.querySelector("slot"), slot);
    assert.equal(slot.getAttribute("name"), "b");
    assert.equal(slot.className, "two");
    container.remove();
  });

  it("keeps foreign children when adopting a container without markers", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>keep</p>";
    document.body.appendChild(container);
    render(html`<b>new</b>`, container, { adopt: true });
    assert.equal(container.querySelector("p").textContent, "keep");
    assert.equal(container.querySelector("b").textContent, "new");
    container.remove();
  });

  it("projectSlots moves a child-part range as one block and whitespace to the default slot", () => {
    const host = document.createElement("div");
    host.$slotParts = new Set();
    host.$root = null;
    host.$queueProject = () => {};
    host.$unslotted = null;
    host.innerHTML = '<!--$--><!--$--><i slot="a">1</i><!--/--><!--$--><i slot="a">2</i><!--/--><!--/-->   <b>text</b>';
    document.body.appendChild(host);
    host.$root = render(html`<slot name="a"></slot><slot></slot>`, host, { host });
    const hooks = { watchSlot() {}, watchUnit() {}, unknown() {} };
    projectSlots(host, hooks);
    const named = host.querySelector("slot[name=a]");
    const fallback = host.querySelector("slot:not([name])");
    assert.equal(named.firstChild.data, "$");
    assert.equal(named.lastChild.data, "/");
    assert.deepEqual([...named.querySelectorAll("i")].map((i) => i.textContent), ["1", "2"]);
    assert.equal(fallback.querySelector("b").textContent, "text");
    assert.equal(fallback.firstChild.nodeType, 3, "the whitespace text moves with the default content");
    assert.equal(host.firstChild.data, "$r");
    host.remove();
  });
});
