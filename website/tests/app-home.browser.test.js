import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { bootApp, disposeApp, until } from "@bootstrapp/test/app.js";
import { PAIRS } from "../lib/home-content.js";
import { PROJECTS } from "../lib/built-with-light.js";

describe("the home page", () => {
  let app;

  before(async () => {
    app = await bootApp("/");
    await until(() => app.doc.querySelector("docs-home my-counter button") !== null);
  });

  after(() => disposeApp(app));

  it("opens on the name, without the catalogue's rail", () => {
    assert.match(app.doc.querySelector("docs-home .home-title").textContent, /^Light/);
    assert.equal(app.doc.querySelector("template-shell lc-nav-tree"), null);
    assert.ok(app.doc.querySelector(".shell-header .shell-brand"));
  });

  it("indexes every pair, and each card points at a section that exists", () => {
    const cards = [...app.doc.querySelectorAll("docs-home .home-index-card")];
    assert.equal(cards.length, PAIRS.length);
    for (const card of cards) assert.ok(app.doc.querySelector(`docs-home section${card.getAttribute("href")}`), card.getAttribute("href"));
  });

  it("counts a click on the counter it shows the code of", async () => {
    const button = app.doc.querySelector("docs-home #counter my-counter button");
    assert.equal(button.textContent, "Clicks: 0");
    button.click();
    await until(() => button.textContent === "Clicks: 1");
    const [plain, big] = app.doc.querySelectorAll("docs-home #attributes my-counter button");
    assert.equal(plain.textContent, "Clicks: 0");
    assert.equal(big.textContent, "Taps: 7");
    assert.ok(big.hasAttribute("data-big"));
  });

  it("draws the form from its fields and dresses the second sign-in card in a skin", async () => {
    await until(() => app.doc.querySelectorAll("docs-home #form lc-form lc-label").length === 3);
    const skinned = app.doc.querySelector("docs-home #theme [data-lc-skin=neobrutalist]");
    await until(() => app.win.getComputedStyle(skinned).getPropertyValue("--radius-field").trim() !== "");
    const plain = app.win.getComputedStyle(app.doc.querySelector("docs-home #theme .home-skin")).getPropertyValue("--radius-field").trim();
    assert.notEqual(app.win.getComputedStyle(skinned).getPropertyValue("--radius-field").trim(), plain);
    assert.deepEqual(app.errors, []);
  });

  it("shows the first projects and links to the full gallery", () => {
    const cards = [...app.doc.querySelectorAll("docs-home .home-built-grid docs-project-card .project-card")];
    assert.equal(cards.length, Math.min(3, PROJECTS.length));
    for (const card of cards) {
      assert.ok(card.getAttribute("href"));
      assert.equal(card.getAttribute("target"), "_blank");
    }
    assert.ok(app.doc.querySelector(`docs-home .home-built-head lc-button[href="/built-with-light"]`));
  });

  it("keeps the catalogue on /components, with its rail back", async () => {
    app.$APP.Router.go("/components");
    await until(() => app.doc.querySelector("showcase-catalogue") !== null);
    await until(() => app.doc.querySelector("template-shell lc-nav-tree") !== null);
    assert.deepEqual(app.errors, []);
  });
});
