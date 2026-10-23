import assert from "node:assert/strict";
import test from "node:test";
import { elements, parseMarkup, parseTemplates, rawValue } from "./markup.js";

/** @param {string} content @param {number} [start] */
const parse = (content, start = 100) => parseMarkup(content, start);
/** @param {import("../types.ts").ParsedTemplate} tpl */
const tags = (tpl) => [...elements(tpl)].map((el) => el.tag);

test("elements nest, close, and carry the file's offsets", () => {
  const src = `
  <section class="hero">
    <h1 part="fx-hero-title">Hi</h1>
    <p>a <b>bold</b> word</p>
  </section>`;
  const tpl = parse(src);
  assert.deepEqual(tags(tpl), ["section", "h1", "p", "b"]);
  const [section] = elements(tpl);
  assert.equal(section.offset, 100 + src.indexOf("<section"));
  assert.equal(section.end, 100 + src.length);
  const h1 = section.children.find((c) => c.kind === "element" && c.tag === "h1");
  assert.equal(h1.parent, section);
  assert.equal(h1.end, 100 + src.indexOf("</h1>") + 5);
  assert.deepEqual(h1.children, [{ kind: "text", text: "Hi", offset: 100 + src.indexOf("Hi") }]);
  const p = section.children.find((c) => c.kind === "element" && c.tag === "p");
  assert.deepEqual(p.children.map((c) => (c.kind === "text" ? c.text : c.tag)), ["a ", "b", " word"]);
});

test("void and self-closing elements do not swallow their siblings", () => {
  const tpl = parse(`<div><input name="a"><br><img src="x"/><lc-icon name="x" /><span>s</span></div>`);
  const [div] = elements(tpl);
  assert.deepEqual(div.children.map((c) => c.kind === "element" && c.tag), ["input", "br", "img", "lc-icon", "span"]);
  assert.ok(div.children.every((c) => c.kind === "element" && c.children.length === (c.tag === "span" ? 1 : 0)));
});

test("attributes come in four kinds, prefix stripped, with statics and expressions", () => {
  const src = `<lc-x class="a \${x} b" ?open=\${o} @click=\${h} .value=\${v} part='fx-x-p' size=large bare title=\${t}></lc-x>`;
  const [el] = elements(parse(src));
  assert.deepEqual(el.attrs.map((a) => [a.name, a.kind]), [["class", "attr"], ["open", "bool"], ["click", "event"], ["value", "prop"], ["part", "attr"], ["size", "attr"], ["bare", "attr"], ["title", "attr"]]);
  const [cls, open, , , part, size, bare, title] = el.attrs;
  assert.deepEqual(cls.statics, ["a ", " b"]);
  assert.equal(cls.value, null);
  assert.deepEqual(cls.expressions, [{ offset: 100 + src.indexOf("${x}"), end: 100 + src.indexOf("${x}") + 4 }]);
  assert.equal(open.offset, 100 + src.indexOf("?open"));
  assert.deepEqual(open.statics, ["", ""]);
  assert.equal(part.value, "fx-x-p");
  assert.equal(size.value, "large");
  assert.equal(bare.value, "");
  assert.deepEqual(bare.statics, [""]);
  assert.equal(title.value, null);
  assert.deepEqual(title.statics, ["", ""]);
  assert.equal(cls.valueOffset, 100 + src.indexOf("a ${x}"));
  assert.equal(rawValue(cls, " ".repeat(100) + src), "a ${x} b");
  assert.equal(rawValue(title, " ".repeat(100) + src), "${t}");
  assert.equal(bare.valueOffset, null);
  assert.equal(rawValue(bare, " ".repeat(100) + src), "");
});

test("text runs mask their expressions and keep offsets; a child expression is a node of its own", () => {
  const src = `<p>Hello \${name}, \${n} new</p><i>\${only}</i>`;
  const [p, i] = elements(parse(src));
  const [text, ...exprs] = p.children;
  assert.equal(text.kind, "text");
  assert.equal(text.text, `Hello ${" ".repeat(7)}, ${" ".repeat(4)} new`);
  assert.equal(text.offset, 100 + src.indexOf("Hello"));
  assert.deepEqual(exprs.map((e) => [e.kind, e.offset - 100]), [["expression", src.indexOf("${name}")], ["expression", src.indexOf("${n}")]]);
  assert.deepEqual(i.children, [{ kind: "expression", offset: 100 + src.indexOf("${only}"), end: 100 + src.indexOf("${only}") + 7 }]);
});

test("comments and the doctype are skipped, and a nested template inside an expression is one expression", () => {
  const src = `<!doctype html><!-- a <b> comment --><ul>\${items.map((item) => html\`<li class="\${item.cls}">\${item.text}</li>\`)}</ul>`;
  const tpl = parse(src);
  assert.deepEqual(tags(tpl), ["ul"]);
  const [ul] = elements(tpl);
  assert.deepEqual(ul.children.map((c) => c.kind), ["expression"]);
});

test("an expression inside a string or an object literal does not end early", () => {
  const src = `<a title=\${t ? "}" : '{'} @click=\${() => go({ a: { b: 1 } })}>x</a>`;
  const [a] = elements(parse(src));
  assert.deepEqual(a.attrs.map((at) => at.name), ["title", "click"]);
  assert.deepEqual(a.children, [{ kind: "text", text: "x", offset: 100 + src.indexOf(">x") + 1 }]);
});

test("raw text elements keep their content as text", () => {
  const src = `<div><style>a > b { color: red; }</style><textarea>\${v}</textarea><span>t</span></div>`;
  const [div, style, textarea, span] = elements(parse(src));
  assert.deepEqual([div.tag, style.tag, textarea.tag, span.tag], ["div", "style", "textarea", "span"]);
  assert.deepEqual(style.children, [{ kind: "text", text: "a > b { color: red; }", offset: 100 + src.indexOf("a > b") }]);
  assert.deepEqual(textarea.children.map((c) => c.kind), ["expression"]);
});

test("an unclosed tag and a stray close tag end without a throw", () => {
  const unclosed = parse(`<div class="x`);
  assert.deepEqual(tags(unclosed), ["div"]);
  assert.equal([...elements(unclosed)][0].attrs[0].value, "x");
  const stray = parse(`<div><span>a</div></p><b>c</b>`);
  assert.deepEqual(tags(stray), ["div", "span", "b"]);
  const [div, span, b] = elements(stray);
  assert.equal(span.parent, div);
  assert.equal(b.parent?.tag, "");
  const dynamic = parse(`<\${tag} a="1">x</\${tag}>`);
  assert.deepEqual(tags(dynamic), []);
});

test("an expression in attribute position is skipped and the tag still closes", () => {
  const src = `<lc-x \${spread} a="1"><i></i></lc-x>`;
  const [el] = elements(parse(src));
  assert.deepEqual(el.attrs.map((a) => a.name), ["a"]);
  assert.deepEqual(el.children.map((c) => c.kind === "element" && c.tag), ["i"]);
});

test("parseTemplates answers the outer template and every nested one, at the file's offsets", () => {
  const src = "<ul>${items.map((item) => html`<li ?done=${item.done}>${item.text} ${html`<b>!</b>`}</li>`)}</ul>";
  const [outer, li, b] = parseTemplates(src, 50);
  assert.deepEqual([...elements(outer)].map((el) => el.tag), ["ul"]);
  assert.deepEqual([...elements(li)].map((el) => [el.tag, el.attrs.map((a) => a.kind)]), [["li", ["bool"]]]);
  assert.equal([...elements(li)][0].offset, 50 + src.indexOf("<li"));
  assert.deepEqual([...elements(b)].map((el) => el.tag), ["b"]);
  assert.equal([...elements(b)][0].offset, 50 + src.indexOf("<b>"));
});
