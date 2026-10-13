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
