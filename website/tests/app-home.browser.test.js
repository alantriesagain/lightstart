import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import { navigate } from "@lightstart/app/web";
import manifest from "../.light/app.ts";
import { PAIRS } from "../lib/home-content.js";
import { PROJECTS } from "../lib/built-with-light.js";
import { until, watchErrors } from "./light-page.js";

describe("the home page", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/" });
    await until(() => document.querySelector("docs-home my-counter button") !== null);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  it("opens on the name, without the catalogue's rail", () => {
    assert.match(document.querySelector("docs-home .home-title").textContent, /^Light/);
    assert.equal(document.querySelector("template-shell lc-nav-tree"), null);
    assert.ok(document.querySelector(".shell-header .shell-brand"));
  });

  it("indexes every pair, and each card points at a section that exists", () => {
    const cards = [...document.querySelectorAll("docs-home .home-index-card")];
    assert.equal(cards.length, PAIRS.length);
    for (const card of cards) assert.ok(document.querySelector(`docs-home section${card.getAttribute("href")}`), card.getAttribute("href"));
  });

  it("counts a click on the counter it shows the code of", async () => {
    const button = document.querySelector("docs-home #counter my-counter button");
    assert.equal(button.textContent, "Clicks: 0");
    button.click();
    await until(() => button.textContent === "Clicks: 1");
    const [plain, big] = document.querySelectorAll("docs-home #attributes my-counter button");
    assert.equal(plain.textContent, "Clicks: 0");
    assert.equal(big.textContent, "Taps: 7");
    assert.ok(big.hasAttribute("data-big"));
  });

  it("draws the form from its fields and dresses the second sign-in card in a skin", async () => {
    await until(() => document.querySelectorAll("docs-home #form lc-form lc-label").length === 3);
    const skinned = document.querySelector("docs-home #theme [data-lc-skin=neobrutalist]");
    await until(() => window.getComputedStyle(skinned).getPropertyValue("--radius-field").trim() !== "");
    const plain = window.getComputedStyle(document.querySelector("docs-home #theme .home-skin")).getPropertyValue("--radius-field").trim();
    assert.notEqual(window.getComputedStyle(skinned).getPropertyValue("--radius-field").trim(), plain);
    assert.deepEqual(raised.errors, []);
  });

  it("shows the first projects and links to the full gallery", () => {
    const cards = [...document.querySelectorAll("docs-home .home-built-grid docs-project-card .project-card")];
    assert.equal(cards.length, Math.min(3, PROJECTS.length));
    for (const card of cards) {
      assert.ok(card.getAttribute("href"));
      assert.equal(card.getAttribute("target"), "_blank");
    }
    assert.ok(document.querySelector(`docs-home .home-built-head lc-button[href="/built-with-light"]`));
  });

  it("keeps the catalogue on /components, with its rail back", async () => {
    navigate("/components");
    await until(() => document.querySelector("showcase-catalogue") !== null);
    await until(() => document.querySelector("template-shell lc-nav-tree") !== null);
    assert.deepEqual(raised.errors, []);
  });
});
