import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { element, html, key, nothing, render } from "@bootstrapp/light/html";

if (typeof document === "undefined")
  throw new Error("document is not defined; browser-only suite, run with --browser");

const KEEP = new Set(["<!--$-->", "<!--/-->", "<!--$r-->", "<!--/r-->"]);
const minify = (markup) =>
  markup.replace(/<!--.*?-->/gs, (m) => (KEEP.has(m) ? m : "")).replace(/>\s+</g, "> <");

const prerender = (template) => {
  const stage = document.createElement("div");
  document.body.appendChild(stage);
  render(template, stage);
  const markup = minify(stage.innerHTML);
  stage.remove();
  return markup;
};

describe("light/html adoption", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("stage one: bind", () => {
    it("adopts prerendered DOM without replacing nodes and attaches listeners", () => {
      let hits = 0;
      const tpl = (label) => html`<section><button @click=${() => hits++}>${label}</button></section>`;
      container.innerHTML = prerender(tpl("press"));
      const section = container.querySelector("section");
      const button = container.querySelector("button");
      render(tpl("press"), container, { adopt: "bind" });
      assert.equal(container.querySelector("section"), section);
      assert.equal(container.querySelector("button"), button);
      assert.equal(button.textContent, "press");
      button.click();
      assert.equal(hits, 1);
    });

    it("keeps prerendered content when bind-time data is empty", () => {
      const tpl = (items) => html`<ul>${items.map((i) => key(i, html`<li>${i}</li>`))}</ul>`;
      container.innerHTML = prerender(tpl(["a", "b", "c"]));
      render(tpl([]), container, { adopt: "bind" });
      assert.equal(container.querySelectorAll("li").length, 3);
      assert.equal(container.textContent.trim(), "abc");
    });

    it("keeps prerendered text when bind-time value is null", () => {
      const tpl = (v) => html`<p>${v}</p>`;
      container.innerHTML = prerender(tpl("baked content"));
      const p = container.querySelector("p");
      render(tpl(null), container, { adopt: "bind" });
      assert.equal(container.querySelector("p"), p);
      assert.equal(p.textContent, "baked content");
    });

    it("seeds attribute baselines so matching commits no-op and drift updates", () => {
      const tpl = (cls, dis) => html`<button class="base ${cls}" ?disabled=${dis}>x</button>`;
      container.innerHTML = prerender(tpl("sel", true));
      const button = container.querySelector("button");
      render(tpl(null, false), container, { adopt: "bind" });
      assert.equal(button.getAttribute("class"), "base sel");
      assert.equal(button.hasAttribute("disabled"), true);
      render(tpl("sel", true), container);
      assert.equal(button.getAttribute("class"), "base sel");
      render(tpl("other", false), container);
      assert.equal(button.getAttribute("class"), "base other");
      assert.equal(button.hasAttribute("disabled"), false);
    });

    it("attaches listeners deep inside nested templates and list items", () => {
      const hits = [];
      const item = (i, onClick) => html`<li><button id="b${i}" @click=${onClick}>${i}</button></li>`;
      const tpl = (items) => html`<ul>${items.map((i) => key(i, item(i, () => hits.push(i))))}</ul>`;
      container.innerHTML = prerender(tpl([1, 2]));
      render(tpl([1, 2]), container, { adopt: "bind" });
      container.querySelector("#b2").click();
      assert.deepEqual(hits, [2]);
    });
  });

  describe("stage two: commit", () => {
    it("no-ops on matching data and updates only drifted text in place", () => {
      const tpl = (v) => html`<article><h1>${v.title}</h1><p>${v.body}</p></article>`;
      container.innerHTML = prerender(tpl({ title: "Baked", body: "Same body" }));
      const h1 = container.querySelector("h1");
      const p = container.querySelector("p");
      render(tpl(null ?? { title: "Baked", body: "Same body" }), container, { adopt: "bind" });
      render(tpl({ title: "Fresh", body: "Same body" }), container);
      assert.equal(container.querySelector("h1"), h1);
      assert.equal(container.querySelector("p"), p);
      assert.equal(h1.textContent, "Fresh");
      assert.equal(p.textContent, "Same body");
    });

    it("adopts matching list items and reconciles later changes", () => {
      const tpl = (items) => html`<ul>${items.map((i) => key(i, html`<li id="li${i}">${i}</li>`))}</ul>`;
      container.innerHTML = prerender(tpl(["a", "b", "c"]));
      const liB = container.querySelector("#lib");
      render(tpl([]), container, { adopt: "bind" });
      render(tpl(["a", "b", "c"]), container);
      assert.equal(container.querySelector("#lib"), liB);
      assert.equal(container.querySelectorAll("li").length, 3);
      render(tpl(["c", "b", "a", "d"]), container);
      assert.equal(container.querySelector("#lib"), liB);
      assert.equal(
        [...container.querySelectorAll("li")].map((li) => li.textContent).join(""),
        "cbad",
      );
    });

    it("re-renders a drifted region without touching siblings", () => {
      const tpl = (v) => html`<header>static</header><main>${v ? html`<b>${v}</b>` : html`<i>none</i>`}</main>`;
      container.innerHTML = prerender(tpl("baked"));
      const header = container.querySelector("header");
      render(tpl("baked"), container, { adopt: "bind" });
      render(tpl(null), container);
      assert.equal(container.querySelector("header"), header);
      assert.equal(container.querySelector("b"), null);
      assert.equal(container.querySelector("i").textContent, "none");
    });
  });

  describe("fallbacks", () => {
    it("renders fresh after children without adoption markers, which are light content", () => {
      container.innerHTML = "<p>light child</p>";
      render(html`<b>live</b>`, container, { adopt: "bind" });
      assert.equal(container.querySelector("p").textContent, "light child");
      assert.equal(container.querySelector("b").textContent, "live");
      assert.ok(container.querySelector("p").compareDocumentPosition(container.querySelector("b")) & Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("keeps foreign children when a null value meets a container without markers", () => {
      container.innerHTML = "<a href='/'>Home</a><a href='/drills'>Drills</a>";
      render(null, container, { adopt: "bind" });
      assert.equal(container.querySelectorAll("a").length, 2);
    });

    it("binds prerendered output to a null first render and clears it on the next", () => {
      container.innerHTML = prerender(html`<b>baked</b>`);
      render(null, container, { adopt: "bind" });
      assert.equal(container.querySelector("b").textContent, "baked");
      render(null, container);
      assert.equal(container.querySelector("b"), null);
    });

    it("a region kept through a pending first render is adopted, not replaced, when its template arrives", () => {
      const body = (rows) => html`<section><h2>today</h2><ul>${rows.map((r) => key(r, html`<li>${r}</li>`))}</ul></section>`;
      const spinner = () => html`<div class="spin">loading</div>`;
      let rows = null;
      const view = () => html`<header>static</header>${() => (rows ? body(rows) : spinner())}`;
      container.innerHTML = prerender(html`<header>static</header>${body(["a", "b"])}`);
      const section = container.querySelector("section");
      const items = [...container.querySelectorAll("li")];
      render(view(), container, { adopt: "bind" });
      assert.equal(container.querySelector("section"), section, "the served region stays while the client is pending");
      assert.equal(container.querySelector(".spin"), null);
      rows = ["a", "b"];
      render(view(), container);
      assert.equal(container.querySelector("section"), section, "the served region is adopted once the client draws the same template");
      assert.deepEqual([...container.querySelectorAll("li")], items, "the list items are the served nodes");
      rows = ["a", "b", "c"];
      render(view(), container);
      assert.equal(container.querySelectorAll("li").length, 3, "and it stays live afterwards");
      assert.equal(container.querySelector("section"), section);
    });

    it("with a settle hook, a value the range cannot adopt is held until the app settles, and the served content stays", async () => {
      const body = (rows) => html`<section><ul>${rows.map((r) => key(r, html`<li>${r}</li>`))}</ul></section>`;
      const spinner = () => html`<div class="spin">loading</div>`;
      let rows = null;
      const view = () => html`<header>static</header>${() => (rows ? body(rows) : spinner())}`;
      container.innerHTML = prerender(html`<header>static</header>${body(["a", "b"])}`);
      const section = container.querySelector("section");
      let settle;
      const settled = new Promise((r) => { settle = r; });
      render(view(), container, { adopt: "bind", settle: () => settled });
      render(view(), container);
      render(view(), container);
      assert.equal(container.querySelector("section"), section, "the spinner drawn again before settle does not replace the served region");
      assert.equal(container.querySelector(".spin"), null);
      rows = ["a", "b"];
      render(view(), container);
      assert.equal(container.querySelector("section"), section, "the matching template adopts the served nodes");
      settle();
      await settled;
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(container.querySelector("section"), section, "settling afterwards changes nothing");
      rows = ["a", "b", "c"];
      render(view(), container);
      assert.equal(container.querySelectorAll("li").length, 3);
    });

    it("with a settle hook, an empty list before settle keeps the served items, and the rows adopt when they land", async () => {
      const tpl = (rows) => html`<div class="grid">${rows.map((r) => html`<a href=${"/" + r}>${r}</a>`)}</div>`;
      container.innerHTML = prerender(tpl(["a", "b", "c"]));
      const links = [...container.querySelectorAll("a")];
      const settled = new Promise(() => {});
      render(tpl([]), container, { adopt: "bind", settle: () => settled });
      render(tpl([]), container);
      assert.deepEqual([...container.querySelectorAll("a")], links, "an empty list before settle is the client still waiting");
      render(tpl(["a", "b", "c"]), container);
      assert.deepEqual([...container.querySelectorAll("a")], links, "the rows adopt the served links");
      render(tpl(["a", "b"]), container);
      assert.equal(container.querySelectorAll("a").length, 2, "and the list is live");
    });

    it("with a settle hook, a region still drifted at settle renders fresh, so real drift never leaves a dead region", async () => {
      const oldTpl = (v) => html`<div><span>${v}</span></div>`;
      const newTpl = (v) => html`<div><em>${v}</em></div>`;
      container.innerHTML = prerender(oldTpl("x"));
      let settle;
      const settled = new Promise((r) => { settle = r; });
      render(newTpl("y"), container, { adopt: "bind", settle: () => settled });
      render(newTpl("y"), container);
      assert.equal(container.querySelector("span").textContent, "x", "served content stays until settle");
      settle();
      await settled;
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(container.querySelector("span"), null);
      assert.equal(container.querySelector("em").textContent, "y", "the client's template wins once the app is idle");
      render(newTpl("z"), container);
      assert.equal(container.querySelector("em").textContent, "z", "and the region is live afterwards");
    });

    it("recovers from structural drift with a fresh render of the region", () => {
      const oldTpl = (v) => html`<div><span>${v}</span></div>`;
      const newTpl = (v) => html`<div><em>${v}</em></div>`;
      container.innerHTML = prerender(oldTpl("x"));
      render(newTpl("y"), container, { adopt: "bind" });
      render(newTpl("y"), container);
      assert.equal(container.querySelector("em").textContent, "y");
    });
  });

  describe("nested component interiors", () => {
    it("adopts a template whose child components carry their own rendered roots", () => {
      let hits = 0;
      const tpl = (label) => html`<div class="card"><x-icon></x-icon><span>${label}</span><button @click=${() => hits++}>go</button></div>`;
      const stage = document.createElement("div");
      document.body.appendChild(stage);
      render(tpl("baked"), stage);
      render(html`<svg viewBox="0 0 4 4"></svg>`, stage.querySelector("x-icon"));
      const markup = stage.innerHTML.replace(/<!--.*?-->/gs, (m) =>
        ["<!--$-->", "<!--/-->", "<!--$r-->", "<!--/r-->"].includes(m) ? m : "",
      );
      stage.remove();

      container.innerHTML = markup;
      const icon = container.querySelector("x-icon");
      const svgEl = container.querySelector("x-icon svg");
      const button = container.querySelector("button");
      render(tpl("baked"), container, { adopt: "bind" });
      assert.equal(container.querySelector("x-icon"), icon);
      assert.equal(container.querySelector("x-icon svg"), svgEl);
      assert.equal(container.querySelector("button"), button);
      button.click();
      assert.equal(hits, 1);
      render(tpl("fresh"), container);
      assert.equal(container.querySelector("span").textContent, "fresh");
      assert.equal(container.querySelector("x-icon svg"), svgEl);
    });
  });

  describe("component-root disambiguation", () => {
    it("adoption pair search skips a parent part pair sitting as light-DOM children", () => {
      const el = document.createElement("x-widget");
      el.innerHTML = `<!--$-->parent slotted<!--/--><!--$r--><div>own content <!--$-->v1<!--/--></div><!--/r-->`;
      document.body.appendChild(el);
      const tpl = (v) => html`<div>own content ${v}</div>`;
      render(tpl("v1"), el, { adopt: "bind" });
      const div = el.querySelector("div");
      render(tpl("v2"), el);
      assert.equal(el.querySelector("div"), div);
      assert.equal(div.textContent, "own content v2");
      assert(el.textContent.includes("parent slotted"), "light-DOM children preserved");
      el.remove();
    });
  });

  describe("slotted hosts", () => {
    const serve = (inner) => {
      container.innerHTML = `<!--$r-->${inner}<!--/r-->`;
    };

    it("adopts a parent's dynamic child through the host's default slot and updates it in place", () => {
      const tpl = (label) => html`<section><x-link href="/x">${label}</x-link></section>`;
      serve('<section><x-link href="/x"><!--$r--><a part="x-link-anchor"><slot data-assigned=""><!--$-->Home<!--/--></slot></a><!--/r--></x-link></section>');
      render(tpl("Home"), container, { adopt: "bind" });
      const a = container.querySelector("a");
      render(tpl("Away"), container);
      assert.equal(container.querySelector("a"), a);
      assert.equal(container.querySelector("slot").textContent, "Away");
      assert.equal(container.querySelector("x-link").firstChild.data, "$r", "no light children appeared");
    });

    it("adopts named static children through their slots, whatever order the slots render in", () => {
      let hits = 0;
      const tpl = (text) => html`<x-card><p slot="body">${text}</p><button slot="footer" @click=${() => hits++}>go</button><h1 slot="header">T</h1></x-card>`;
      serve('<x-card><!--$r--><div part="x-card-header"><slot name="header" data-assigned=""><h1 slot="header">T</h1></slot></div><slot name="body" data-assigned=""><p slot="body"><!--$-->hi<!--/--></p></slot><slot name="footer" data-assigned=""><button slot="footer">go</button></slot><!--/r--></x-card>');
      render(tpl("hi"), container, { adopt: "bind" });
      const p = container.querySelector("p");
      container.querySelector("button").click();
      assert.equal(hits, 1, "the listener bound on the served button");
      render(tpl("yo"), container);
      assert.equal(container.querySelector("p"), p);
      assert.equal(p.textContent, "yo");
    });

    it("re-renders a host whose dynamic children landed in two slots, without throwing", () => {
      const tpl = (a, b) => html`<x-card>${a}${b}</x-card>`;
      serve('<x-card><!--$r--><slot name="h" data-assigned=""><!--$-->A<!--/--></slot><slot data-assigned=""><!--$-->B<!--/--></slot><!--/r--></x-card>');
      const served = container.querySelector("x-card");
      render(tpl("A", "B"), container, { adopt: "bind" });
      render(tpl("A", "B"), container);
      assert.notEqual(container.querySelector("x-card"), served);
      assert.equal(container.querySelector("x-card").textContent, "AB");
    });

    it("adopts a host's own assigned slot, with its fallback parked for later", () => {
      const tpl = (v) => html`<div><slot>fallback ${v}</slot></div>`;
      serve('<div><slot data-assigned=""><!--$-->given<!--/--></slot></div>');
      const part = render(tpl("v1"), container, { adopt: "bind" });
      const div = container.querySelector("div");
      render(tpl("v2"), container);
      assert.equal(container.querySelector("div"), div);
      const slotEl = container.querySelector("slot");
      assert.equal(slotEl.textContent, "given");
      const slot = part.state.instance.parts.find((p) => p.el === slotEl);
      assert.equal(slot.parked.textContent, "fallback v2");
      for (const node of [...slotEl.childNodes]) node.remove();
      slot.restore();
      assert.equal(slotEl.textContent, "fallback v2");
      assert.equal(slotEl.hasAttribute("data-assigned"), false);
    });

    it("adopts an element() host's children through its slot, without a second copy", () => {
      const tpl = (label) => html`<nav>${element("x-link", { href: "/x" }, label)}</nav>`;
      serve('<nav><!--$--><x-link href="/x"><!--$r--><a><slot data-assigned=""><!--$-->Home<!--/--></slot></a><!--/r--></x-link><!--/--></nav>');
      render(tpl("Home"), container, { adopt: "bind" });
      const a = container.querySelector("a");
      render(tpl("Away"), container);
      assert.equal(container.querySelector("a"), a);
      assert.equal(container.querySelector("x-link").textContent, "Away");
    });
  });
});
