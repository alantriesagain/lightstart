import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HTML_KIND, SVG_KIND } from "../html/constants.ts";
import { TplComment, TplElement, TplText, decodeEntities, tokenize } from "../html/tokenizer.ts";
import { MElement, MFragment, MRoot, MText, MarkupHost, insertBefore, isConnected, markupOf, nextSiblingOf, removeNode, serialize, textContent } from "./index.js";

/** @param {import("../html/tokenizer.ts").TplNode[]} nodes */
const shape = (nodes) =>
  nodes.map((n) => {
    if (n instanceof TplElement) return `${n.tag}${n.marked ? "*" : ""}${n.attrs.size ? JSON.stringify([...n.attrs]) : ""}(${shape(n.children)})`;
    if (n instanceof TplComment) return `#${n.data}`;
    return JSON.stringify(/** @type {TplText} */ (n).data);
  }).join("");

describe("light/html/tokenizer", () => {
  it("reads elements, attributes, text and comments, lowercasing HTML names", () => {
    assert.equal(shape(tokenize(`<DIV Class="a" id=b>t<!--c--><p>x</p></DIV>`, HTML_KIND)), `div[["class","a"],["id","b"]]("t"#cp("x"))`);
  });

  it("takes the marker attribute as the element's mark and keeps marker comments", () => {
    assert.equal(shape(tokenize(`<a data-$$ href="x"><!--$--><!--/--></a>`, HTML_KIND)), `a*[["href","x"]](#$#/)`);
  });

  it("gives void elements no children and ignores a self-closing slash on HTML elements", () => {
    assert.equal(shape(tokenize(`<br><input value=1><div/>after`, HTML_KIND)), `br()input[["value","1"]]()div("after")`);
  });

  it("self-closes svg elements and keeps their names' case", () => {
    assert.equal(shape(tokenize(`<svg viewBox="0 0 1 1"><circle r="1"/><foreignObject/></svg>`, SVG_KIND)), `svg[["viewBox","0 0 1 1"]](circle[["r","1"]]()foreignObject())`);
  });

  it("keeps the text of raw-text elements as is, decoding only textarea and title", () => {
    assert.equal(shape(tokenize(`<script>if (a < b) {}</script><textarea>&lt;x&gt;</textarea><style>a &gt; b</style>`, HTML_KIND)), `script("if (a < b) {}")textarea("<x>")style("a &gt; b")`);
  });

  it("decodes named and numeric character references, leaving unknown ones", () => {
    assert.equal(decodeEntities("&lt;&amp;&#65;&#x42;&nbsp;&bogus;&"), "<&AB &bogus;&");
    assert.equal(shape(tokenize(`<p title="&quot;q&quot;">&amp;</p>`, HTML_KIND)), `p[["title","\\"q\\""]]("&")`);
  });

  it("closes to the nearest open element of the tag and ignores unmatched end tags", () => {
    assert.equal(shape(tokenize(`<a><b>x</a>y</c>z`, HTML_KIND)), `a(b("x"))"yz"`);
  });

  it("keeps the first of duplicate attributes and a bare attribute as empty", () => {
    assert.equal(shape(tokenize(`<p a="1" a="2" hidden>`, HTML_KIND)), `p[["a","1"],["hidden",""]]()`);
  });
});

describe("light/markup/node", () => {
  it("inserts, removes and links siblings, and splices a fragment's children in", () => {
    const root = new MRoot();
    const a = new MElement("a");
    const b = new MElement("b");
    insertBefore(root, b, null);
    insertBefore(root, a, b);
    assert.equal(nextSiblingOf(a), b);
    assert.equal(nextSiblingOf(b), null);
    const fragment = new MFragment();
    insertBefore(fragment, new MText("1"), null);
    insertBefore(fragment, new MText("2"), null);
    insertBefore(root, fragment, b);
    assert.equal(fragment.children.length, 0);
    assert.equal(markupOf(root), "<a></a>12<b></b>");
    removeNode(a);
    assert.equal(a.parent, null);
    assert.equal(markupOf(root), "12<b></b>");
  });

  it("counts a node as connected only under a root", () => {
    const root = new MRoot();
    const el = new MElement("p");
    const inner = new MText("t");
    insertBefore(el, inner, null);
    assert.equal(isConnected(inner), false);
    insertBefore(root, el, null);
    assert.equal(isConnected(inner), true);
  });
});

describe("light/markup/element surface", () => {
  it("reads and writes attributes, their names and the class list", () => {
    const el = new MElement("div");
    assert.equal(el.getAttribute("a"), null);
    el.setAttribute("a", "1");
    el.setAttribute("b", 2);
    assert.equal(el.getAttribute("a"), "1");
    assert.equal(el.getAttribute("b"), "2");
    assert.ok(el.hasAttribute("a"));
    assert.deepEqual(el.getAttributeNames(), ["a", "b"]);
    assert.deepEqual(el.attributes, [{ name: "a", value: "1" }, { name: "b", value: "2" }]);
    assert.equal(el.toggleAttribute("hidden"), true);
    assert.equal(el.toggleAttribute("hidden"), false);
    assert.equal(el.toggleAttribute("hidden", true), true);
    assert.equal(el.getAttribute("hidden"), "");
    el.toggleAttribute("hidden", false);
    assert.equal(el.hasAttribute("hidden"), false);
    el.removeAttribute("a");
    assert.equal(el.hasAttribute("a"), false);

    el.classList.add("x", "y");
    assert.equal(el.getAttribute("class"), "x y");
    assert.ok(el.classList.contains("x"));
    assert.equal(el.classList.toggle("x"), false);
    assert.equal(el.classList.toggle("z", true), true);
    el.classList.remove("y");
    assert.equal(el.getAttribute("class"), "z");
  });

  it("advances the child list, parents and connectivity like a DOM node", () => {
    const root = new MRoot();
    const parent = new MElement("ul");
    const first = new MElement("li");
    const second = new MElement("li");
    parent.append(first, "text", second);
    root.appendChild(parent);
    assert.equal(parent.childNodes.length, 3);
    assert.deepEqual(parent.children, [first, second]);
    assert.equal(parent.firstChild, first);
    assert.equal(first.parentNode, parent);
    assert.equal(first.parentElement, parent);
    assert.equal(first.isConnected, true);
    assert.equal(root.localName, "#root");
    assert.equal(first.localName, "li");
    assert.equal(first.tagName, "LI");
    assert.equal(first.getRootNode(), root);

    const third = new MElement("li");
    parent.insertBefore(third, second);
    assert.equal(parent.childNodes[2], third);
    third.replaceWith(new MElement("li"));
    assert.equal(third.parentNode, null);
    assert.equal(parent.children[2].localName, "li");
    parent.removeChild(second);
    assert.equal(second.parentNode, null);
    parent.remove();
    assert.equal(parent.isConnected, false);
    assert.equal(root.childNodes.length, 0);
  });

  it("matches tag, class, id, attribute and descendant selectors", () => {
    const root = new MRoot();
    const outer = new MElement("div");
    outer.setAttribute("class", "card main");
    const span = new MElement("span");
    span.setAttribute("id", "title");
    const link = new MElement("a");
    link.setAttribute("href", "/x");
    span.appendChild(link);
    outer.appendChild(span);
    root.appendChild(outer);
    assert.equal(root.querySelector("div"), outer);
    assert.equal(root.querySelector(".card"), outer);
    assert.equal(root.querySelector("#title"), span);
    assert.equal(root.querySelector("[href]"), link);
    assert.equal(root.querySelector("div span a"), link);
    assert.equal(root.querySelector("div > span"), span);
    assert.equal(root.querySelector("span > a"), link);
    assert.equal(root.querySelector("div > a"), null);
    assert.deepEqual(root.querySelectorAll("a"), [link]);
    assert.equal(outer.querySelector("div"), null);
  });

  it("adds, removes and dispatches listeners, and reads and writes text", () => {
    const el = new MElement("p");
    /** @type {string[]} */
    const seen = [];
    const listener = (event) => seen.push(event.type);
    el.addEventListener("go", listener);
    assert.equal(el.dispatchEvent({ type: "go" }), true);
    el.dispatchEvent({ type: "go" });
    el.removeEventListener("go", listener);
    el.dispatchEvent({ type: "go" });
    assert.deepEqual(seen, ["go", "go"]);

    el.childNodes.push(new MText("x"));
    assert.equal(el.textContent, "x");
    el.textContent = "y & z";
    assert.equal(el.childNodes.length, 1);
    assert.equal(el.textContent, "y & z");
  });
});

describe("light/markup/serialize", () => {
  it("escapes text and attributes, keeps script text raw, and writes void elements without end tags", () => {
    const host = new MarkupHost();
    const root = new MRoot();
    const p = new MElement("p");
    host.setAttribute(p, "title", "a\"b&c");
    host.insertBefore(p, host.createText("x < y & z "), null);
    host.insertBefore(root, p, null);
    host.insertBefore(root, host.createElement("br"), null);
    const script = new MElement("script");
    host.insertBefore(script, host.createText("if (a < b) {}"), null);
    host.insertBefore(root, script, null);
    host.insertBefore(root, host.createAnchor("$"), null);
    assert.equal(serialize(root), `<p title="a&quot;b&amp;c">x &lt; y &amp; z&nbsp;</p><br><script>if (a < b) {}</script><!--$-->`);
    assert.equal(markupOf(root), `<p title="a&quot;b&amp;c">x &lt; y &amp; z&nbsp;</p><br><script>if (a < b) {}</script>`);
    assert.equal(textContent(root), "x < y & z if (a < b) {}");
  });
});

describe("renderToString", () => {
  it("renders a template with markers a page adopts, escaping its values", async () => {
    const { html, key } = await import("../html/core.ts");
    const { renderToString } = await import("./index.js");
    const item = (row) => html`<li class=${row.done ? "done" : "open"}>${row.title}</li>`;
    const page = (rows) => html`<section><h1>${"Tasks & more"}</h1><ul>${rows.map((row) => key(row.id, item(row)))}</ul></section>`;
    const out = renderToString(page([{ id: "a", title: "<one>", done: true }, { id: "b", title: "two", done: false }]));
    assert.match(out, /^<!--\$r-->/);
    assert.ok(out.includes("Tasks &amp; more"));
    assert.ok(out.includes('<li class="done"><!--$-->&lt;one&gt;<!--/--></li>'));
    assert.ok(out.includes('<li class="open">'));
    assert.equal(renderToString(page([]), { markers: false }), "<section><h1>Tasks &amp; more</h1><ul></ul></section>");
  });

  it("puts back the host that was in use", async () => {
    const { currentHost, setHost, html } = await import("../html/core.ts");
    const { renderToString } = await import("./index.js");
    const before = new MarkupHost();
    setHost(before);
    renderToString(html`<p>x</p>`);
    assert.equal(currentHost(), before);
  });
});
