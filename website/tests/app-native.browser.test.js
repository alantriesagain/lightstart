import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import { navigate } from "@lightstart/app/web";
import manifest from "../.light/app.ts";
import catalogue from "../src/controllers/catalogue.js";
import { until, watchErrors } from "./light-page.js";

describe("the native introduction", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/native" });
    await until(() => document.querySelectorAll("docs-native .native-index li").length > 0);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  it("lists the section's pages in their two groups, both in the nav column", async () => {
    assert.deepEqual([...document.querySelectorAll("docs-native .native-group h2")].map((node) => node.textContent), ["Native", "Background"]);
    const links = [...document.querySelectorAll("docs-native .native-index a")].map((node) => node.textContent);
    assert.ok(links.includes("How it works") && links.includes("How to use") && links.includes("Concepts"));
    const nav = () => document.querySelector("template-shell lc-nav-tree")?.textContent ?? "";
    await until(() => nav().includes("Background"));
    assert.ok(nav().includes("Writing fast code"), nav());
    assert.deepEqual(raised.errors, []);
  });
});

describe("the comparison page", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/native/comparison" });
    await until(() => document.querySelectorAll("docs-native-comparison lc-flow .flow-step").length > 0);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  /** @param {string} label */
  const step = (label) => [...document.querySelectorAll("docs-native-comparison .flow-step")].find((node) => node.querySelector(".flow-step-label")?.textContent === label);
  const panelTitle = () => document.querySelector("docs-native-comparison .native-step h3")?.textContent;

  it("draws the three roads under four phases, and opens on the source", () => {
    assert.deepEqual([...document.querySelectorAll("docs-native-comparison .flow-lane-label b")].map((node) => node.textContent), ["Browser", "Node", "Native (scriptc)"]);
    assert.deepEqual([...document.querySelectorAll("docs-native-comparison .flow-phase")].map((node) => node.textContent), ["Source", "Types", "Build", "Run"]);
    assert.equal(panelTitle(), "counter.ts");
    assert.match(document.querySelector("docs-native-comparison .native-step lc-code-block")?.code ?? "", /class Counter/);
  });

  it("shows the step a reader picks with its captured output", async () => {
    step("Machine code").click();
    await until(() => panelTitle() === "Native (scriptc): machine code");
    const blocks = [...document.querySelectorAll("docs-native-comparison .native-step lc-code-block")];
    assert.equal(blocks.length, 1);
    assert.match(blocks[0].code, /addsd/);
    step("Bytecode").click();
    await until(() => panelTitle() === "V8: bytecode");
    assert.match(document.querySelector("docs-native-comparison .native-step lc-code-block").code, /GetNamedProperty/);
  });

  it("drops the marked lines when the next step marks none", async () => {
    step("Type checker").click();
    await until(() => document.querySelectorAll("docs-native-comparison .native-step .code-block-line[data-marked]").length === 2);
    step("Typed IR").click();
    await until(() => panelTitle() === "Native (scriptc): typed IR");
    assert.equal(document.querySelectorAll("docs-native-comparison .native-step .code-block-line[data-marked]").length, 0);
    assert.deepEqual(raised.errors, []);
  });

  it("lists the native pages in the nav column and the outline in the aside", async () => {
    await until(() => document.querySelector("template-shell lc-nav-tree") !== null);
    await until(() => (document.querySelector("template-shell lc-nav-tree")?.textContent ?? "").includes("Comparison"));
    await until(() => catalogue.toc.length === 2);
    assert.deepEqual(catalogue.toc.map((item) => item.id), ["comparison", "differences"]);
    assert.deepEqual(raised.errors, []);
  });
});

describe("the native topic pages", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/native" });
    await until(() => document.querySelectorAll("docs-native .native-index li").length > 0);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  const topics = ["how-it-works", "how-to-use", "issues", "concepts", "javascript", "scriptc", "types", "performance", "tsc-ts"];

  it("draws every page with its sections, its outline and a pager", async () => {
    for (const topic of topics) {
      navigate(`/native/${topic}`);
      await until(() => document.querySelector("docs-native-topic")?.getAttribute("topic") === topic || document.querySelector("docs-native-topic")?.topic === topic);
      await until(() => document.querySelectorAll("docs-native-topic .topic-section").length > 0);
      const sections = [...document.querySelectorAll("docs-native-topic .topic-section")];
      await until(() => catalogue.toc.length === sections.length);
      assert.deepEqual(catalogue.toc.map((item) => item.id), sections.map((section) => section.id), `${topic}: the outline lists the sections`);
      assert.ok(document.querySelector("docs-native-topic lc-pagination"), `${topic}: a pager`);
      assert.ok(document.querySelectorAll("docs-native-topic lc-code-block, docs-native-topic lc-table").length > 0, `${topic}: captured output or a table`);
    }
    assert.deepEqual(raised.errors, []);
  });

  it("opens a step's deeper page at the section it names, with one page lit in the nav", async () => {
    navigate("/native/comparison");
    await until(() => document.querySelectorAll("docs-native-comparison lc-flow .flow-step").length > 0);
    const asm = [...document.querySelectorAll("docs-native-comparison .flow-step")].find((node) => node.querySelector(".flow-step-label")?.textContent === "Machine code");
    asm.click();
    await until(() => document.querySelector("docs-native-comparison .native-more") !== null);
    document.querySelector("docs-native-comparison .native-more a, docs-native-comparison .native-more").click();
    await until(() => document.querySelector("docs-native-topic #machine-code") !== null);
    assert.equal(page.run.router.path, "/native/scriptc");
    assert.equal(page.run.router.adapter.getLocation().hash, "#machine-code");
    await until(() => document.querySelectorAll("template-shell lc-nav-tree [active]").length === 1);
    assert.match(document.querySelector("template-shell lc-nav-tree [active]").textContent, /How scriptc works/);
    assert.deepEqual(raised.errors, []);
  });
});
