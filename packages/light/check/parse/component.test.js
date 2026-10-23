import assert from "node:assert/strict";
import test from "node:test";
import { definitionOf, parseComponentSources } from "./component.js";

const LIGHT = 'import View from "@bootstrapp/light";\n';

test("parseComponentSources reads tag, flags, keys and property defaults of a default export", () => {
  const src = `export default {
  tag: "fx-card",
  style: true,
  props: {
    rows: /** @type {any} */ (T.array({ defaultValue: [] })),
    bare: T.number(0),
    none: T.string(),
    nul: T.object({ defaultValue: null }),
  },
  render() {},
};
`;
  const [parsed] = parseComponentSources(src, "views/card.js");
  assert.equal(parsed.tag, "fx-card");
  assert.equal(parsed.styleTrue, true);
  assert.equal(parsed.defined, false);
  assert.equal(parsed.offset, src.indexOf("{"));
  assert.deepEqual(parsed.topLevelKeys, ["tag", "style", "props", "render"]);
  assert.deepEqual(Object.fromEntries(parsed.propertyNames.map((p) => [p.name, p.hasNonNullDefault])), { rows: true, bare: true, none: false, nul: false });
  assert.equal(parsed.keyOffsets.render, src.indexOf("render()"));
  assert.equal(parsed.propsOffset, src.indexOf("{\n    rows"));
});

test("parseComponentSources unwraps wrappers and answers nothing without a literal", () => {
  const wrapped = `export default defineComponent({ mixins: [withThing], tag: "fx-w", props: { v: T.string() } });`;
  assert.equal(parseComponentSources(wrapped, "w.js")[0].tag, "fx-w");
  const fn = `export default () => { const x = 1; return { tag: "fx-fn" }; };`;
  assert.equal(parseComponentSources(fn, "fn.js")[0].tag, "fx-fn");
  assert.deepEqual(parseComponentSources("export const a = 1;", "a.js"), []);
  assert.deepEqual(parseComponentSources("export default 42;", "n.js"), []);
});

test("a definition assigned to a name, passed to View.define and exported below is one site, the call's", () => {
  const named = `${LIGHT}const Def = defineComponent({ tag: "fx-named", style: true, render() {} });

View.define("fx-named", Def);

export default Def;
`;
  const parsed = parseComponentSources(named, "docs/named.js");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tag, "fx-named");
  assert.equal(parsed[0].styleTrue, true);
  assert.equal(parsed[0].defined, true);
  assert.equal(parsed[0].offset, named.indexOf("View.define("));
  assert.deepEqual(parsed[0].topLevelKeys, ["tag", "style", "render"]);
});

test("without light's import a View.define call is no site, and the export still is", () => {
  const named = `const Def = { tag: "fx-bare" };\nView.define("fx-bare", Def);\nexport default Def;\n`;
  const parsed = parseComponentSources(named, "docs/bare.js");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tag, "fx-bare");
  assert.equal(parsed[0].defined, false);
});

test("a name that holds no literal, or refers to itself, defines nothing", () => {
  assert.deepEqual(parseComponentSources("const Def = 42;\nexport default Def;\n", "n.js"), []);
  assert.deepEqual(parseComponentSources("export default Missing;\n", "m.js"), []);
  assert.deepEqual(parseComponentSources("const Def = Def;\nexport default Def;\n", "loop.js"), []);
});

test("View.define's five shapes each read as a component", () => {
  const src = `${LIGHT}import { html } from "@bootstrapp/light/html";
View.define({ tag: "fx-one", props: { a: T.string() }, render() {} });
View.define("fx-two", { props: { b: 0 }, connected() {} });
View.define("fx-three", (el) => html\`<b>\${el.c}</b>\`);
View.define("fx-four", { d: 1 }, { mixins: [withX], close() {} });
View.define("fx-five", { e: "" }, (el) => html\`<i>\${el.e}</i>\`);
`;
  const parsed = parseComponentSources(src, "page.js");
  assert.deepEqual(parsed.map((p) => p.tag), ["fx-one", "fx-two", "fx-three", "fx-four", "fx-five"]);
  assert.ok(parsed.every((p) => p.defined));
  const [one, two, three, four, five] = parsed;
  assert.deepEqual(one.propertyNames.map((p) => p.name), ["a"]);
  assert.equal(two.offset, src.indexOf('View.define("fx-two"'));
  assert.deepEqual(two.propertyNames.map((p) => p.name), ["b"]);
  assert.deepEqual(two.topLevelKeys, ["props", "connected"]);
  assert.deepEqual(three.topLevelKeys, ["render"]);
  assert.equal(three.literal, null);
  assert.equal(three.keyOffsets.render, src.indexOf("(el) => html`<b>"));
  assert.equal(three.styleKnown, true);
  assert.deepEqual(four.propertyNames.map((p) => p.name), ["d"]);
  assert.equal(four.propsOffset, src.indexOf("{ d: 1 }"));
  assert.equal(four.keyOffsets.props, four.propsOffset);
  assert.deepEqual(four.topLevelKeys, ["mixins", "close"]);
  assert.deepEqual(five.propertyNames.map((p) => p.name), ["e"]);
  assert.deepEqual(five.topLevelKeys, ["render"]);
});

test("props and render given as named constants, inside an exported function, are followed", () => {
  const src = `${LIGHT}import { html } from "@bootstrapp/light/html";
const props = { label: "Clicks", count: 0 };
const render = (el) => html\`<button>\${el.label}: \${el.count}</button>\`;
export const defineDemos = () => {
  View.define("my-counter", props, render);
};
`;
  const [counter] = parseComponentSources(src, "demos.js");
  assert.equal(counter.tag, "my-counter");
  assert.deepEqual(counter.propertyNames.map((p) => [p.name, p.hasNonNullDefault]), [["label", true], ["count", true]]);
  assert.deepEqual(counter.topLevelKeys, ["render"]);
  assert.equal(counter.keyOffsets.render, src.indexOf("(el) => html"));
});

test("a tag the parser cannot read leaves tag null and keeps the definition", () => {
  const src = `${LIGHT}const define = (attribute) => View.define(attribute ? "bench-a" : "bench-b", { props: { n: 0 } });\n`;
  const [site] = parseComponentSources(src, "reflect.js");
  assert.equal(site.tag, null);
  assert.deepEqual(site.propertyNames.map((p) => p.name), ["n"]);
});

test("the tag argument wins over a tag key inside the literal", () => {
  const [site] = parseComponentSources(`${LIGHT}View.define("fx-a", { tag: "fx-b" });\n`, "x.js");
  assert.equal(site.tag, "fx-a");
});

test("a View that is a parameter is not light's import, and a definition nothing can read is no site", () => {
  const param = `${LIGHT}const install = (View) => View.define("app-container", { tag: "app-container" });\nexport default { connected() { install(this.constructor); } };\n`;
  assert.deepEqual(parseComponentSources(param, "frontend.js").map((p) => p.tag), [null]);
  const loop = `${LIGHT}for (const path of ["display/button"]) View.define((await import(\`@bootstrapp/light/components/\${path}.js\`)).default);\n`;
  assert.deepEqual(parseComponentSources(loop, "index.js"), []);
});

test("a factory in the definition's place leaves style unknown", () => {
  const [site] = parseComponentSources(`${LIGHT}View.define("fx-ed", editorFor({ kind: "code" }));\n`, "ed.js");
  assert.equal(site.tag, "fx-ed");
  assert.equal(site.styleKnown, false);
});

test("definitionOf picks the definition naming the tag, else a module's only one", () => {
  const parsed = parseComponentSources(`${LIGHT}View.define("fx-a", { props: { a: 1 } });\nView.define("fx-b", { props: { b: 1 } });\n`, "two.js");
  assert.equal(definitionOf(parsed, "fx-b")?.propertyNames[0].name, "b");
  assert.equal(definitionOf(parsed, "fx-c"), null);
  const sole = parseComponentSources("export default { props: { s: 1 } };", "sole.js");
  assert.equal(definitionOf(sole, "lc-sole")?.propertyNames[0].name, "s");
});
