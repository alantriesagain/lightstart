import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import { navigate } from "@lightstart/app/web";
import manifest from "../.light/app.ts";
import { until, watchErrors } from "./light-page.js";

const counted = (doc) => [...doc.querySelectorAll("lc-nav-tree .nav-tree-count")].reduce((sum, el) => sum + Number(el.textContent), 0);

describe("the overview and a category", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/components" });
    await until(() => document.querySelectorAll(".catalogue-card").length > 0);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  it("shows one card per component and a sink in the hero", () => {
    assert.equal(document.querySelectorAll(".catalogue-card").length, counted(document));
    assert.ok(document.querySelector("showcase-catalogue showcase-sink"));
    assert.match(document.querySelector("showcase-catalogue h1").textContent, /components/);
  });

  it("opens a component from its card", async () => {
    document.querySelector(".catalogue-card").click();
    await until(() => page.run.router.path === "/components/form/auth-form");
    await until(() => document.querySelector("docs-component h1")?.textContent === "Auth Form");
  });

  it("narrows a category page to its own components", async () => {
    navigate("/components/display");
    await until(() => document.querySelector("docs-category h1")?.textContent === "Display");
    const count = Number([...document.querySelectorAll("lc-nav-tree .nav-tree-group")].find((group) => group.textContent.includes("Display")).querySelector(".nav-tree-count").textContent);
    await until(() => document.querySelectorAll(".catalogue-card").length === count);
    assert.equal(document.querySelector("showcase-catalogue .catalogue-lead"), null);
    assert.ok(document.querySelector("docs-category lc-pagination[variant=pager]"));
    assert.deepEqual(raised.errors, []);
  });
});
