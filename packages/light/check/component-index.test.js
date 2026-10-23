import assert from "node:assert/strict";
import test from "node:test";
import { contextFromFiles } from "./test-utils.js";

const ui = { owner: "ui", dir: "/fixture/node_modules/@bootstrapp/ui", components: { ui: "views/", lc: { widget: "./special/widget.js" } } };

test("the index resolves the project's views and a host map's components", () => {
  const ctx = contextFromFiles({
    "views/card.js": 'export default { tag: "fx-card", props: { title: T.string() } };',
    "node_modules/@bootstrapp/ui/views/button.js": 'export default { tag: "ui-button", props: { label: T.string() } };',
    "node_modules/@bootstrapp/ui/views/form/field.js": "export default {};",
    "node_modules/@bootstrapp/ui/special/widget.js": "export default { props: { size: T.number() } };",
  }, { host: { componentMaps: () => [ui] } });
  const index = ctx.componentIndex();
  assert.equal(index.has("fx-card"), true);
  assert.equal(index.ownerOf("fx-card"), null);
  assert.deepEqual([...index.propsOf("fx-card")], ["title"]);
  assert.equal(index.ownerOf("ui-button"), "ui");
  assert.ok(index.sourceOf("ui-button").includes("ui-button"));
  assert.deepEqual([...index.propsOf("ui-button")], ["label"]);
  assert.equal(index.has("ui-form-field"), true);
  assert.equal(index.has("lc-widget"), true);
  assert.ok(index.sourceOf("lc-widget").includes("size"));
  assert.equal(index.has("ui-missing"), false);
  assert.equal(index.propsOf("ui-missing"), null);
  assert.equal(index.sourceOf("ui-missing"), null);
});

test("a tag from the project's own folder structure is known without a literal tag, and the first writer wins", () => {
  const ctx = contextFromFiles({
    "views/plain.js": "export default {};",
    "views/card.js": 'export default { tag: "fx-card" };',
    "node_modules/@bootstrapp/ui/views/card.js": 'export default { tag: "fx-card", props: { stolen: T.string() } };',
  }, { host: { componentMaps: () => [{ ...ui, components: { fx: "views/" } }] } });
  const index = ctx.componentIndex();
  assert.equal(index.has("fx-plain"), true);
  assert.equal(index.ownerOf("fx-card"), null);
  assert.deepEqual([...index.propsOf("fx-card")], []);
});

test("mixinSourcesOf follows relative mixin imports from the project and from a map", () => {
  const ctx = contextFromFiles({
    "views/menu.js": 'import { withEscape } from "../mixins/escape.js";\nexport default { tag: "fx-menu", mixins: [withEscape] };',
    "mixins/escape.js": "export const withEscape = { events: { close: T.object() } };",
    "node_modules/@bootstrapp/ui/views/sheet.js": 'import { withDrag } from "./mixins/drag.js";\nexport default { tag: "ui-sheet", mixins: [withDrag] };',
    "node_modules/@bootstrapp/ui/views/mixins/drag.js": "export const withDrag = { events: { dragged: T.object() } };",
  }, { host: { componentMaps: () => [ui] } });
  const index = ctx.componentIndex();
  assert.deepEqual(index.mixinSourcesOf("fx-menu").map((s) => s.includes("close")), [true]);
  assert.deepEqual(index.mixinSourcesOf("ui-sheet").map((s) => s.includes("dragged")), [true]);
  assert.deepEqual(index.mixinSourcesOf("ui-nope"), []);
});

test("the maps are asked again after the index is cleared", () => {
  let maps = [ui];
  const ctx = contextFromFiles({
    "views/card.js": 'export default { tag: "fx-card" };',
    "node_modules/@bootstrapp/ui/views/button.js": 'export default { tag: "ui-button" };',
  }, { host: { componentMaps: () => maps } });
  assert.equal(ctx.componentIndex().has("ui-button"), true);
  maps = [];
  ctx.invalidate("package.json");
  assert.equal(ctx.componentIndex().has("ui-button"), false);
  assert.equal(ctx.componentIndex().has("fx-card"), true);
});

test("propsOf picks the definition naming the tag when a project file holds several", () => {
  const ctx = contextFromFiles({
    "views/pair.js": 'import View from "@bootstrapp/light";\nView.define("fx-a", { props: { a: 1 } });\nView.define("fx-b", { props: { b: 1 } });\n',
  });
  const index = ctx.componentIndex();
  assert.deepEqual([...index.propsOf("fx-a")], ["a"]);
  assert.deepEqual([...index.propsOf("fx-b")], ["b"]);
  assert.equal(index.sourceOf("fx-a"), index.sourceOf("fx-b"));
});
