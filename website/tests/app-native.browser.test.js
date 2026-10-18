import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { bootApp, disposeApp, until } from "@bootstrapp/test/app.js";

describe("the native introduction", () => {
  let app;

  before(async () => {
    app = await bootApp("/native");
    await until(() => app.doc.querySelectorAll("docs-native .native-index li").length > 0);
  });

  after(() => disposeApp(app));

  it("lists the section's pages in their two groups, both in the nav column", async () => {
    assert.deepEqual([...app.doc.querySelectorAll("docs-native .native-group h2")].map((node) => node.textContent), ["Native", "Background"]);
    const links = [...app.doc.querySelectorAll("docs-native .native-index a")].map((node) => node.textContent);
    assert.ok(links.includes("How it works") && links.includes("How to use") && links.includes("Concepts"));
    const nav = () => app.doc.querySelector("template-shell lc-nav-tree")?.textContent ?? "";
    await until(() => nav().includes("Background"));
    assert.ok(nav().includes("Writing fast code"), nav());
    assert.deepEqual(app.errors, []);
  });
});

describe("the comparison page", () => {
  let app;

  before(async () => {
    app = await bootApp("/native/comparison");
    await until(() => app.doc.querySelectorAll("docs-native-comparison lc-flow .flow-step").length > 0);
  });

  after(() => disposeApp(app));

  /** @param {string} label */
  const step = (label) => [...app.doc.querySelectorAll("docs-native-comparison .flow-step")].find((node) => node.querySelector(".flow-step-label")?.textContent === label);
  const panelTitle = () => app.doc.querySelector("docs-native-comparison .native-step h3")?.textContent;

  it("draws the three roads under four phases, and opens on the source", () => {
    assert.deepEqual([...app.doc.querySelectorAll("docs-native-comparison .flow-lane-label b")].map((node) => node.textContent), ["Browser", "Node", "Native (scriptc)"]);
    assert.deepEqual([...app.doc.querySelectorAll("docs-native-comparison .flow-phase")].map((node) => node.textContent), ["Source", "Types", "Build", "Run"]);
    assert.equal(panelTitle(), "counter.ts");
    assert.match(app.doc.querySelector("docs-native-comparison .native-step lc-code-block")?.code ?? "", /class Counter/);
  });

  it("shows the step a reader picks with its captured output", async () => {
    step("Machine code").click();
    await until(() => panelTitle() === "Native (scriptc): machine code");
    const blocks = [...app.doc.querySelectorAll("docs-native-comparison .native-step lc-code-block")];
    assert.equal(blocks.length, 1);
    assert.match(blocks[0].code, /addsd/);
    step("Bytecode").click();
    await until(() => panelTitle() === "V8: bytecode");
    assert.match(app.doc.querySelector("docs-native-comparison .native-step lc-code-block").code, /GetNamedProperty/);
  });

  it("drops the marked lines when the next step marks none", async () => {
    step("Type checker").click();
    await until(() => app.doc.querySelectorAll("docs-native-comparison .native-step .code-block-line[data-marked]").length === 2);
    step("Typed IR").click();
    await until(() => panelTitle() === "Native (scriptc): typed IR");
    assert.equal(app.doc.querySelectorAll("docs-native-comparison .native-step .code-block-line[data-marked]").length, 0);
    assert.deepEqual(app.errors, []);
  });

  it("lists the native pages in the nav column and the outline in the aside", async () => {
    await until(() => app.doc.querySelector("template-shell lc-nav-tree") !== null);
    await until(() => (app.doc.querySelector("template-shell lc-nav-tree")?.textContent ?? "").includes("Comparison"));
    await until(() => app.$APP.catalogue.toc.length === 2);
    assert.deepEqual(app.$APP.catalogue.toc.map((item) => item.id), ["comparison", "differences"]);
    assert.deepEqual(app.errors, []);
  });
});

describe("the native topic pages", () => {
  let app;

  before(async () => {
    app = await bootApp("/native");
    await until(() => app.doc.querySelectorAll("docs-native .native-index li").length > 0);
  });

  after(() => disposeApp(app));

  const topics = ["how-it-works", "how-to-use", "issues", "concepts", "javascript", "scriptc", "types", "performance", "tsc-ts"];

  it("draws every page with its sections, its outline and a pager", async () => {
    for (const topic of topics) {
      app.$APP.Router.go(`/native/${topic}`);
      await until(() => app.doc.querySelector("docs-native-topic")?.getAttribute("topic") === topic || app.doc.querySelector("docs-native-topic")?.topic === topic);
      await until(() => app.doc.querySelectorAll("docs-native-topic .topic-section").length > 0);
      const sections = [...app.doc.querySelectorAll("docs-native-topic .topic-section")];
      await until(() => app.$APP.catalogue.toc.length === sections.length);
      assert.deepEqual(app.$APP.catalogue.toc.map((item) => item.id), sections.map((section) => section.id), `${topic}: the outline lists the sections`);
      assert.ok(app.doc.querySelector("docs-native-topic lc-pagination"), `${topic}: a pager`);
      assert.ok(app.doc.querySelectorAll("docs-native-topic lc-code-block, docs-native-topic lc-table").length > 0, `${topic}: captured output or a table`);
    }
    assert.deepEqual(app.errors, []);
  });

  it("opens a step's deeper page at the section it names, with one page lit in the nav", async () => {
    app.$APP.Router.go("/native/comparison");
    await until(() => app.doc.querySelectorAll("docs-native-comparison lc-flow .flow-step").length > 0);
    const asm = [...app.doc.querySelectorAll("docs-native-comparison .flow-step")].find((node) => node.querySelector(".flow-step-label")?.textContent === "Machine code");
    asm.click();
    await until(() => app.doc.querySelector("docs-native-comparison .native-more") !== null);
    app.doc.querySelector("docs-native-comparison .native-more a, docs-native-comparison .native-more").click();
    await until(() => app.doc.querySelector("docs-native-topic #machine-code") !== null);
    assert.equal(app.win.location.pathname, "/native/scriptc");
    assert.equal(app.win.location.hash, "#machine-code");
    await until(() => app.doc.querySelectorAll("template-shell lc-nav-tree [active]").length === 1);
    assert.match(app.doc.querySelector("template-shell lc-nav-tree [active]").textContent, /How scriptc works/);
    assert.deepEqual(app.errors, []);
  });
});
