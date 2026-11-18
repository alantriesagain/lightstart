import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";
import { PROJECTS } from "../lib/built-with-light.js";
import { until, watchErrors } from "./light-page.js";

describe("the built-with page", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/built-with-light" });
    await until(() => document.querySelectorAll("docs-built-with-light .project-card").length === PROJECTS.length);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  it("draws one card per project, each linking out", () => {
    const cards = [...document.querySelectorAll("docs-built-with-light .project-card")];
    assert.equal(cards.length, PROJECTS.length);
    assert.deepEqual(cards.map((card) => card.getAttribute("href")), PROJECTS.map((project) => project.url));
    for (const card of cards) {
      assert.equal(card.getAttribute("target"), "_blank");
      assert.match(card.getAttribute("rel"), /noopener/);
    }
  });

  it("leaves the catalogue rail off and offers the submission link", () => {
    assert.equal(document.querySelector("template-shell lc-nav-tree"), null);
    assert.equal(document.querySelector("docs-built-with-light .docs-title").textContent, "Built with Light");
    const submit = document.querySelector("docs-built-with-light .built-submit lc-button");
    assert.match(submit.getAttribute("href"), /github\.com\/alantriesagain\/light\/issues\/new/);
    assert.deepEqual(raised.errors, []);
  });
});
