import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { bootApp, disposeApp, until } from "@bootstrapp/test/app.js";
import { PROJECTS } from "../lib/built-with-light.js";

describe("the built-with page", () => {
  let app;

  before(async () => {
    app = await bootApp("/built-with-light");
    await until(() => app.doc.querySelectorAll("docs-built-with-light .project-card").length === PROJECTS.length);
  });

  after(() => disposeApp(app));

  it("draws one card per project, each linking out", () => {
    const cards = [...app.doc.querySelectorAll("docs-built-with-light .project-card")];
    assert.equal(cards.length, PROJECTS.length);
    assert.deepEqual(cards.map((card) => card.getAttribute("href")), PROJECTS.map((project) => project.url));
    for (const card of cards) {
      assert.equal(card.getAttribute("target"), "_blank");
      assert.match(card.getAttribute("rel"), /noopener/);
    }
  });

  it("leaves the catalogue rail off and offers the submission link", () => {
    assert.equal(app.doc.querySelector("template-shell lc-nav-tree"), null);
    assert.equal(app.doc.querySelector("docs-built-with-light .docs-title").textContent, "Built with Light");
    const submit = app.doc.querySelector("docs-built-with-light .built-submit lc-button");
    assert.match(submit.getAttribute("href"), /github\.com\/alantriesagain\/light\/issues\/new/);
    assert.deepEqual(app.errors, []);
  });
});
