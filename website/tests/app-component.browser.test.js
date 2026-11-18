import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import { navigate } from "@lightstart/app/web";
import manifest from "../.light/app.ts";
import { until, watchErrors } from "./light-page.js";

describe("a component's page", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/components/display/button" });
    await until(() => document.querySelectorAll("showcase-component-doc lc-example").length > 0);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  it("draws the breadcrumbs, one example per demo example, and the outline", async () => {
    assert.equal(document.querySelectorAll("lc-breadcrumbs .breadcrumbs-item").length, 3);
    const examples = document.querySelectorAll("showcase-component-doc lc-example.component-doc-example");
    assert.ok(examples.length >= 5);
    await until(() => document.querySelectorAll("lc-toc .toc-link").length === examples.length + 3);
    assert.equal(document.querySelector("lc-toc .toc-link").getAttribute("href"), "#examples");
  });

  it("walks to the next component through the pager and keeps the outline current", async () => {
    const next = document.querySelector("lc-pagination[variant=pager] .pagination-pager-link.next");
    assert.ok(next, "a next link");
    assert.match(next.getAttribute("href"), /\/components\/display\/calendar$/);
    navigate("/components/display/calendar");
    await until(() => document.querySelector("docs-component h1")?.textContent === "Calendar");
    await until(() => document.querySelectorAll("showcase-component-doc lc-example").length > 0);
    const examples = document.querySelectorAll("showcase-component-doc lc-example.component-doc-example");
    await until(() => document.querySelectorAll("lc-toc .toc-link").length === examples.length + 3);
  });

  it("opens a neighbour from the page's own prev control", async () => {
    document.querySelector("showcase-component-doc .component-doc-nav lc-button").click();
    await until(() => page.run.router.path === "/components/display/button");
    await until(() => document.querySelector("docs-component h1")?.textContent === "Button");
  });

  it("drops the outline when the next page has none", async () => {
    await until(() => document.querySelectorAll("lc-toc .toc-link").length > 0);
    navigate("/theming");
    await until(() => document.querySelector("docs-theming") !== null);
    await until(() => document.querySelectorAll("lc-toc .toc-link").length === 0);
    assert.deepEqual(raised.errors, []);
  });
});
