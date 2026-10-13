import assert from "node:assert/strict";
import test from "node:test";
import { contextFromFiles } from "./test-utils.js";
import { createContext } from "./context.js";
import { elements } from "./parse/markup.js";

const VIEW = `import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";

export default {
  tag: "fx-card",
  style: true,
  props: {
    items: T.array({ defaultValue: [] }),
    draft: T.string(),
  },
  connected() {},
  render() {
    return html\`<div class="card">\${this.items.map((i) => html\`<span>\${i.name}</span>\`)}</div>\`;
  },
};
`;

test("views() parses component shape", () => {
  const ctx = contextFromFiles({ "views/card.js": VIEW, "views/util.js": "export const cap = (s) => s;" });
  const views = ctx.views();
  assert.equal(views.length, 2);
  const card = views.find((v) => v.file === "views/card.js");
  assert.equal(card.isComponent, true);
  assert.equal(card.tag, "fx-card");
  assert.equal(card.styleTrue, true);
  assert.deepEqual(card.propertyNames.map((p) => p.name), ["items", "draft"]);
  assert.ok(card.topLevelKeys.includes("connected"));
  const util = views.find((v) => v.file === "views/util.js");
  assert.equal(util.isComponent, false);
});

test("views() flags props whose defaultValue is non-null", () => {
  const src = `export default {
  tag: "fx-defaults",
  props: {
    rows: T.array({ defaultValue: [] }),
    bundle: T.object({ defaultValue: null }),
    ghost: T.object({ defaultValue: undefined }),
    item: T.object(),
    label: "plain",
  },
  render() { return null; },
};
`;
  const ctx = contextFromFiles({ "views/defaults.js": src });
  const byName = Object.fromEntries(ctx.views()[0].propertyNames.map((p) => [p.name, p.hasNonNullDefault]));
  assert.deepEqual(byName, { rows: true, bundle: false, ghost: false, item: false, label: true });
});

test("views() reads a defineComponent with mixins like any other", () => {
  const src = `import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
  mixins: [withThing],
  tag: "fx-wrapped",
  props: { value: T.string() },
  render() { return null; },
});
`;
  const ctx = contextFromFiles({ "views/wrapped.js": src });
  const view = ctx.views()[0];
  assert.equal(view.tag, "fx-wrapped");
  assert.deepEqual(view.propertyNames.map((p) => p.name), ["value"]);
});

test("views() looks through a JSDoc cast when reading defaultValue", () => {
  const src = `export default {
  tag: "fx-x",
  props: {
    rows: /** @type {any} */ (T.array({ defaultValue: [] })),
    bare: T.number(0),
    none: T.string(),
  },
};
`;
  const ctx = contextFromFiles({ "views/x.js": src });
  const names = Object.fromEntries(ctx.views()[0].propertyNames.map((p) => [p.name, p.hasNonNullDefault]));
  assert.deepEqual(names, { rows: true, bare: true, none: false });
});

test("templates() extracts nested html extents", () => {
  const ctx = contextFromFiles({ "views/card.js": VIEW });
  const tpls = ctx.templates("views/card.js");
  assert.equal(tpls.length, 1);
  assert.ok(tpls[0].content.includes('class="card"'));
  assert.ok(tpls[0].content.includes("<span>"));
});

test("lineAt maps offsets to 1-based line/col", () => {
  const ctx = contextFromFiles({ "a.js": "one\ntwo\nthree" });
  assert.deepEqual(ctx.lineAt("a.js", 0), { line: 1, col: 1 });
  assert.deepEqual(ctx.lineAt("a.js", 4), { line: 2, col: 1 });
  assert.deepEqual(ctx.lineAt("a.js", 9), { line: 3, col: 2 });
});

test("imports() classifies static and dynamic imports", () => {
  const src = `import "@bootstrapp/light/theme/theme.css";
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
const mod = await import("./lazy.js");
`;
  const ctx = contextFromFiles({ "main.js": src });
  const imports = ctx.imports("main.js");
  assert.deepEqual(imports.map((i) => [i.spec, i.kind]), [
    ["@bootstrapp/light/theme/theme.css", "side-effect"],
    ["@bootstrapp/light", "default"],
    ["@bootstrapp/light/html", "named"],
    ["./lazy.js", "dynamic"],
  ]);
});

test("imports() ignores a specifier quoted inside a comment", () => {
  const ctx = contextFromFiles({
    "views/a.js": '/** consumers import { X } from "@bootstrapp/camera/commands.js" */\n// import "@bootstrapp/nope";\nimport T from "@bootstrapp/light/types";\nconst m = () => import("@bootstrapp/anim");',
  });
  assert.deepEqual(ctx.imports("views/a.js").map((i) => [i.spec, i.kind]), [["@bootstrapp/light/types", "default"], ["@bootstrapp/anim", "dynamic"]]);
});

test("classAttrs() captures literal, mixed, bound and object-key class values, from templates only", () => {
  const src = '/* <i class="gone"></i> */\nhtml`<div class="a b"><span class=${done ? "x" : "y"}></span><em class="c ${d} e"></em></div>`; export default { class: "host" };';
  const ctx = contextFromFiles({ "views/x.js": src });
  const attrs = ctx.classAttrs("views/x.js");
  assert.deepEqual(attrs.map((a) => [a.value, a.template]), [["a b", false], ['done ? "x" : "y"', true], ["c ${} e", false], ["host", false]]);
  assert.equal(attrs[0].offset, src.indexOf('class="a b"'));
  const page = contextFromFiles({ "index.html": '<div class="hero"></div>\n<script type="module">\nimport View from "@bootstrapp/light";\nimport { html } from "@bootstrapp/light/html";\nView.define("fx-a", {}, (el) => html`<b class="inner"></b>`);\n</script>\n' });
  assert.deepEqual(page.classAttrs("index.html").map((a) => a.value), ["inner"]);
});

test("markup() answers each template as a tree, cached until the file is invalidated", () => {
  const map = {
    "package.json": JSON.stringify({ name: "fixture", bootstrapp: { components: { fx: "views/" } } }),
    "views/x.js": 'import { html, svg } from "@bootstrapp/light/html";\nexport default { tag: "fx-x", render() { return html`<lc-y ?open=${this.o}><i part="fx-x-dot"></i></lc-y>`; }, icon() { return svg`<circle r="1"></circle>`; } };',
  };
  const ctx = createContext({ projectDir: "/fixture", fileMap: map });
  const [first, second] = ctx.markup("views/x.js");
  const [y, i] = elements(first);
  assert.deepEqual([y.tag, i.tag, i.parent?.tag], ["lc-y", "i", "lc-y"]);
  assert.deepEqual(y.attrs.map((a) => [a.name, a.kind]), [["open", "bool"]]);
  assert.equal(ctx.lineAt("views/x.js", i.offset).line, 2);
  assert.deepEqual([...elements(second)].map((el) => el.tag), ["circle"]);
  assert.equal(ctx.markup("views/x.js"), ctx.markup("views/x.js"));
  map["views/x.js"] = 'import { html } from "@bootstrapp/light/html";\nexport default { tag: "fx-x", render() { return html`<p></p>`; } };';
  ctx.invalidate("views/x.js");
  assert.deepEqual([...elements(ctx.markup("views/x.js")[0])].map((el) => el.tag), ["p"]);
});

test("deps merge the manifest's dependency blocks and the check.from names; hasDep reads them", () => {
  const ctx = contextFromFiles({}, { pkgJson: { name: "x", dependencies: { "@bootstrapp/light": "^1" }, devDependencies: { typescript: "^5" }, bootstrapp: { check: { from: ["@bootstrapp/check"] } } } });
  assert.deepEqual(ctx.deps, { "@bootstrapp/light": "^1", typescript: "^5", "@bootstrapp/check": "workspace:*" });
  assert.equal(ctx.hasDep("light"), true);
  assert.equal(ctx.hasDep("check"), true);
  assert.equal(ctx.hasDep("tw"), false);
  assert.equal(ctx.styling, "css");
  assert.deepEqual([...ctx.pluginHooks], []);
});

test("a host supplies its own notion of a dependency, the styling and the plugin hooks and events", () => {
  const ctx = contextFromFiles({}, {
    pkgJson: { name: "x", dependencies: { bootstrapp: "^1" } },
    host: { hasDep: (dep, model) => dep === "view" && !!model.deps.bootstrapp, styling: "tailwind", pluginHooks: ["dataLoaded"], pluginEvents: ["dataLoaded"] },
  });
  assert.equal(ctx.hasDep("view"), true);
  assert.equal(ctx.hasDep("light"), false);
  assert.equal(ctx.styling, "tailwind");
  assert.ok(ctx.pluginHooks.has("dataLoaded"));
  assert.ok(ctx.pluginEvents.has("dataLoaded"));
});

test("files() leaves out the ignored directories, the check.ignore prefixes and what the host prunes", () => {
  const ctx = contextFromFiles(
    { "views/a.js": "", "node_modules/x/index.js": "", "dist/out.js": "", "website/index.html": "", "native/android/x.kt": "", "lib/b.js": "" },
    { pkgJson: { name: "x", bootstrapp: { check: { ignore: ["website/"] } } }, host: { ignore: { dirs: ["native"] } } },
  );
  assert.deepEqual(ctx.files(), ["lib/b.js", "package.json", "views/a.js"]);
});

test("a scope restricts files() to one directory", () => {
  const ctx = contextFromFiles({ "views/a.js": "", "lib/b.js": "", "examples/todo/app.js": 'export default { tag: "todo-app" };' }, { host: { scope: "examples/todo/", componentDirs: () => ["examples/todo/"] } });
  assert.deepEqual(ctx.files(), ["examples/todo/app.js"]);
  assert.deepEqual(ctx.views().map((v) => v.tag), ["todo-app"]);
});

test("invalidate() refreshes every cached view of a file, and the file set when it changes", () => {
  const map = {
    "package.json": JSON.stringify({ name: "fixture", bootstrapp: { components: { fx: "views/" } } }),
    "views/card.js": 'export default { tag: "fx-card", props: { a: T.string() } };',
    "index.js": '/* x */ import "./lib.js";',
    "lib.js": "",
  };
  const ctx = createContext({ projectDir: "/fixture", fileMap: map });
  assert.equal(ctx.views().length, 1);
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-card")], ["a"]);
  assert.ok(ctx.code("index.js").startsWith("       "));
  assert.equal(ctx.lineAt("index.js", 8).col, 9);

  map["views/card.js"] = 'export default { tag: "fx-card", props: { b: T.string() } };';
  map["index.js"] = "\nexport const nothing = 1;";
  ctx.invalidate("views/card.js");
  ctx.invalidate("index.js");
  assert.deepEqual(ctx.viewsIn("views/card.js")[0].propertyNames.map((p) => p.name), ["b"]);
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-card")], ["b"]);
  assert.equal(ctx.code("index.js"), map["index.js"]);
  assert.equal(ctx.lineAt("index.js", 1).line, 2);

  map["views/new.js"] = 'export default { tag: "fx-new" };';
  ctx.invalidate("views/new.js");
  assert.ok(ctx.files().includes("views/new.js"));
  assert.equal(ctx.componentIndex().has("fx-new"), true);
  delete map["views/new.js"];
  ctx.invalidate("views/new.js");
  assert.ok(!ctx.files().includes("views/new.js"));
  assert.equal(ctx.componentIndex().has("fx-new"), false);
});

test("views() covers a components map given in the nested name -> path form", () => {
  const pkgJson = {
    name: "@bootstrapp/light",
    bootstrapp: { components: { lc: { button: "display/button.js", modal: "overlay/modal.js" } } },
  };
  const ctx = contextFromFiles(
    {
      "display/button.js": 'export default { tag: "lc-button" };',
      "overlay/modal.js": 'export default { tag: "lc-modal" };',
      "views/ide-sidebar.js": 'export default { tag: "lc-ide-sidebar" };',
      "utils/pure.js": "export const id = (s) => s;",
    },
    { pkgJson },
  );
  const files = ctx.views().map((v) => v.file).sort();
  assert.deepEqual(files, ["display/button.js", "overlay/modal.js"]);
});

test("views() falls back to views/ only when no components map resolves a directory, and a host adds directories", () => {
  const pkgJson = { name: "fixture", bootstrapp: { components: {} } };
  const files = { "views/card.js": 'export default { tag: "fx-card" };', "display/button.js": 'export default { tag: "fx-button" };' };
  assert.deepEqual(contextFromFiles(files, { pkgJson }).views().map((v) => v.file), ["views/card.js"]);
  const hosted = contextFromFiles(files, { pkgJson, host: { componentDirs: () => ["display/"] } });
  assert.deepEqual(hosted.componentDirs, ["views/", "display/"]);
  assert.deepEqual(hosted.views().map((v) => v.tag), ["fx-button", "fx-card"]);
});

const LIGHT = 'import View from "@bootstrapp/light";\nimport { html } from "@bootstrapp/light/html";\n';

test("views() lists one view per definition, several per file, and a placeholder for a file defining nothing", () => {
  const ctx = contextFromFiles({
    "views/pair.js": `${LIGHT}View.define("fx-a", { a: 1 }, (el) => html\`<i>\${el.a}</i>\`);\nView.define("fx-b", { props: { b: 2 }, connected() {} });\n`,
    "views/util.js": "export const cap = (s) => s;",
  });
  assert.deepEqual(ctx.views().map((v) => [v.file, v.tag, v.isComponent]), [["views/pair.js", "fx-a", true], ["views/pair.js", "fx-b", true], ["views/util.js", null, false]]);
  assert.deepEqual(ctx.viewsIn("views/pair.js").map((v) => v.propertyNames.map((p) => p.name)), [["a"], ["b"]]);
  assert.deepEqual(ctx.componentFiles(), ["views/pair.js", "views/util.js"]);
});

test("a View.define call counts wherever it stands; a default-exported literal only in a component directory", () => {
  const ctx = contextFromFiles({
    "views/card.js": 'export default { tag: "fx-card" };',
    "lib/page.js": `${LIGHT}export const mount = () => View.define("fx-page", {}, (el) => html\`<p></p>\`);\n`,
    "lib/literal.js": 'export default { tag: "fx-literal" };',
    "lib/other.js": 'customElements.define("x-y", class extends HTMLElement {});',
  });
  assert.deepEqual(ctx.views().map((v) => v.tag), ["fx-page", "fx-card"]);
  assert.equal(ctx.componentIndex().has("fx-page"), true);
  assert.equal(ctx.componentIndex().has("fx-literal"), false);
});

test("an html page's module scripts are its JavaScript, at the page's own lines", () => {
  const page = `<!doctype html>
<script type="importmap">{ "imports": { "@bootstrapp/light": "../view/index.js" } }</script>
<div class="hero">x</div>
<script type="module">
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
View.define("fx-hero", { title: "" }, (el) => html\`<h1 part="fx-hero-title">\${el.title}</h1>\`);
</script>
`;
  const ctx = contextFromFiles({ "index.html": page, "views/a.js": "" });
  const [hero] = ctx.viewsIn("index.html");
  assert.equal(hero.tag, "fx-hero");
  assert.equal(ctx.lineAt("index.html", hero.keyOffsets.render).line, 7);
  assert.deepEqual(ctx.views().map((v) => v.tag), ["fx-hero", null]);
  assert.deepEqual(ctx.imports("index.html").map((i) => i.spec), ["@bootstrapp/light", "@bootstrapp/light/html"]);
  assert.ok(!(ctx.code("index.html") || "").includes("importmap"));
  assert.ok(ctx.templates("index.html")[0].content.includes("fx-hero-title"));
  assert.deepEqual(ctx.classAttrs("index.html"), []);
  assert.equal(ctx.componentIndex().has("fx-hero"), true);
});

test("invalidate() of a define file outside the component directories refreshes the index", () => {
  const map = {
    "package.json": JSON.stringify({ name: "fixture", bootstrapp: { components: { fx: "views/" } } }),
    "lib/page.js": `${LIGHT}View.define("fx-page", { a: 1 }, (el) => html\`<p></p>\`);\n`,
  };
  const ctx = createContext({ projectDir: "/fixture", fileMap: map });
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-page")], ["a"]);
  map["lib/page.js"] = `${LIGHT}View.define("fx-page", { b: 1 }, (el) => html\`<p></p>\`);\n`;
  ctx.invalidate("lib/page.js");
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-page")], ["b"]);
});

test("invalidate(rel, text) stands the text in for the file until invalidated without it", () => {
  const map = {
    "package.json": JSON.stringify({ name: "fixture", bootstrapp: { components: { fx: "views/" } } }),
    "views/card.js": 'export default { tag: "fx-card", props: { a: 1 } };',
  };
  const ctx = createContext({ projectDir: "/fixture", fileMap: map });
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-card")], ["a"]);
  const edited = '/* x */\nexport default { tag: "fx-card", props: { b: 1 } };';
  ctx.invalidate("views/card.js", edited);
  assert.equal(ctx.read("views/card.js"), edited);
  assert.ok(ctx.code("views/card.js").startsWith("       \n"));
  assert.deepEqual(ctx.viewsIn("views/card.js")[0].propertyNames.map((p) => p.name), ["b"]);
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-card")], ["b"]);
  assert.equal(ctx.lineAt("views/card.js", edited.indexOf("export")).line, 2);
  assert.equal(map["views/card.js"].includes("props: { a: 1 }"), true);
  ctx.invalidate("views/card.js");
  assert.deepEqual([...ctx.componentIndex().propsOf("fx-card")], ["a"]);
});

test("controllers() reads every defineController call in the project's scripts, tests and comments aside", () => {
  const map = {
    "controllers/ledger.js": 'export default defineController({ name: "ledger", props: { month: "" } });',
    "lib/stores.js": 'export const a = defineController({ name: "a" });\nexport const b = defineController({ name: "b" });',
    "lib/doc.js": "/** Build one with defineController({ name }). */\nexport const x = 1;",
    "controllers/ledger.test.js": 'defineController({ name: "fixture" });',
    "tests/helpers.js": 'defineController({ name: "helper" });',
  };
  const ctx = contextFromFiles(map);
  assert.deepEqual(ctx.controllers().map((c) => [c.file, c.name]), [["controllers/ledger.js", "ledger"], ["lib/stores.js", "a"], ["lib/stores.js", "b"]]);
  assert.deepEqual(ctx.dependencyControllers(), []);
  ctx.invalidate("lib/stores.js", 'export const c = defineController({ name: "c" });');
  assert.deepEqual(ctx.controllers().map((c) => c.name), ["ledger", "c"]);
});

test("a host's controller files are the dependency controllers; its adapter names join the ones the project registers", () => {
  const ctx = contextFromFiles({
    "node_modules/@bootstrapp/devices/controllers/devices.js": 'export default defineController({ name: "devices" });',
    "frontend.js": 'registerAdapter("custom", makeAdapter());\n// registerAdapter("commented", x);',
    "lib/doc.js": 'export const doc = createDocumentAdapter("notes-doc");',
  }, { host: { controllerFiles: () => ["node_modules/@bootstrapp/devices/controllers/devices.js"], syncAdapters: ["local"] } });
  assert.deepEqual(ctx.dependencyControllers().map((c) => c.name), ["devices"]);
  assert.deepEqual(ctx.controllers(), []);
  assert.deepEqual([...ctx.syncAdapters()].sort(), ["custom", "local", "notes-doc"]);
});
