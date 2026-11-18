import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";
import catalogue from "../src/controllers/catalogue.js";
import presets from "@lightstart/light/theme/presets.js";
import { linkStyles, until, watchErrors } from "./light-page.js";

describe("catalogue controller and the shell", () => {
  let page;
  let raised;

  before(async () => {
    await linkStyles();
    raised = watchErrors();
    page = await openPage(manifest, { path: "/components" });
    await until(() => document.querySelectorAll("lc-nav-tree .nav-tree-group").length === 9);
  });

  after(async () => {
    catalogue.chooseSkin("default");
    await page.stop();
    raised.stop();
  });

  it("lists every category in the tree and folds a long one", () => {
    const groups = [...document.querySelectorAll("lc-nav-tree .nav-tree-group")];
    assert.equal(groups.length, 9);
    assert.ok(document.querySelector("lc-nav-tree .nav-tree-more"));
  });

  it("opens the palette on the shortcut and closes it", async () => {
    const palette = document.querySelector("lc-command-palette");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    await until(() => palette.open === true);
    const modal = palette.querySelector("lc-modal");
    await until(() => modal.dialog?.open === true);
    const rect = modal.dialog.getBoundingClientRect();
    assert.ok(Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) < 2, "the palette is centred across the page");
    assert.ok(Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) < 2, "the palette is centred down the page");
    const search = palette.querySelector("lc-search");
    search.query = "timeline";
    await until(() => search.querySelector(".search-dropdown .search-result") !== null);
    const dropdown = search.querySelector(".search-dropdown");
    assert.equal(window.getComputedStyle(dropdown).position, "static", "the results stay in the palette instead of floating over it");
    const result = search.querySelector(".search-result");
    assert.ok(result.getBoundingClientRect().bottom <= modal.dialog.getBoundingClientRect().bottom, "the last result stays inside the dialog");
    const icon = search.querySelector(".search-icon").getBoundingClientRect();
    const input = search.querySelector(".search-input").getBoundingClientRect();
    assert.ok(icon.top >= input.top && icon.bottom <= input.bottom, "the search icon stays inside the field");
    palette.open = false;
    await until(() => modal.dialog?.open === false);
  });

  it("navigates from a palette pick and applies a skin from another", async () => {
    catalogue.select({ id: "component:display/badge", group: "Components", title: "Badge", href: "/components/display/badge", kind: "component" });
    await until(() => page.run.router.path === "/components/display/badge");
    await until(() => document.querySelector("docs-component h1")?.textContent === "Badge");
    catalogue.select({ id: "skin:neobrutalist", group: "Skins", title: "Neobrutalist", kind: "skin", skin: "neobrutalist" });
    assert.equal(catalogue.skin, "neobrutalist");
  });

  it("dresses the stages in the skin and leaves the chrome alone", async () => {
    await until(() => document.querySelector('lc-example [data-lc-skin="neobrutalist"]') !== null);
    const stage = document.querySelector('lc-example [data-lc-skin="neobrutalist"]');
    await until(() => window.getComputedStyle(stage).getPropertyValue("--border-width").trim() === "3px");
    const header = document.querySelector(".shell-header");
    assert.notEqual(window.getComputedStyle(header).getPropertyValue("--border-width").trim(), "3px");
    assert.equal(document.querySelector(".shell-skin span").textContent, "Neobrutalist");
  });

  it("offers every preset in the skin menu with the current one checked", async () => {
    await until(() => catalogue.skins.length === presets.length);
    catalogue.chooseSkin("neobrutalist");
    await until(() => document.querySelector(".shell-skin span").textContent === "Neobrutalist");
    const menu = document.querySelector("#docs-skin-menu");
    menu.toggle(document.querySelector(".shell-skin"));
    const checked = () => [...menu.querySelectorAll(".shell-skin-row")].filter((row) => row.getAttribute("aria-checked") === "true").map((row) => row.querySelector("b").textContent);
    await until(() => menu.open === true && checked().includes("Neobrutalist"));
    assert.equal(menu.querySelectorAll(".shell-skin-row").length, presets.length);
    assert.deepEqual(checked(), ["Neobrutalist"]);
    menu.querySelector(".shell-skin-row").click();
    await until(() => catalogue.skin === "");
    await until(() => document.querySelector(".shell-skin span").textContent === "Default");
  });

  it("toggles dark mode from the header", async () => {
    document.querySelector("lc-darkmode button").click();
    await until(() => document.documentElement.classList.contains("dark"));
    document.querySelector("lc-darkmode button").click();
    await until(() => !document.documentElement.classList.contains("dark"));
  });

  it("moves the tree into a drawer on a phone", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, get: () => 390 });
    window.dispatchEvent(new Event("resize"));
    const shell = document.querySelector("lc-app-shell");
    await until(() => shell.querySelector("[part~=lc-app-shell-menu-button]") !== null);
    shell.querySelector("[part~=lc-app-shell-menu-button]").click();
    await until(() => shell.querySelector("lc-drawer")?.open === true);
    assert.ok(document.querySelector(".shell-nav-skin"));
    Object.defineProperty(window, "innerWidth", { configurable: true, get: () => 1024 });
    window.dispatchEvent(new Event("resize"));
    await until(() => shell.querySelector("[part~=lc-app-shell-menu-button]") === null);
    assert.deepEqual(raised.errors, []);
  });
});
