import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { bootApp, disposeApp, awaitModule, until } from "@bootstrapp/test/app.js";
import presets from "@lightstart/light/theme/presets.js";

describe("catalogue controller and the shell", () => {
  let app;
  let catalogue;

  before(async () => {
    app = await bootApp("/components");
    catalogue = await awaitModule(app.win, "catalogue");
    await until(() => app.doc.querySelectorAll("lc-nav-tree .nav-tree-group").length === 9);
  });

  after(() => {
    catalogue.chooseSkin("default");
    disposeApp(app);
  });

  it("lists every category in the tree and folds a long one", () => {
    const groups = [...app.doc.querySelectorAll("lc-nav-tree .nav-tree-group")];
    assert.equal(groups.length, 9);
    assert.ok(app.doc.querySelector("lc-nav-tree .nav-tree-more"));
  });

  it("opens the palette on the shortcut and closes it", async () => {
    const palette = app.doc.querySelector("lc-command-palette");
    app.doc.dispatchEvent(new app.win.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    await until(() => palette.open === true);
    const modal = palette.querySelector("lc-modal");
    await until(() => modal.dialog?.open === true);
    const rect = modal.dialog.getBoundingClientRect();
    assert.ok(Math.abs(rect.left + rect.width / 2 - app.win.innerWidth / 2) < 2, "the palette is centred across the page");
    assert.ok(Math.abs(rect.top + rect.height / 2 - app.win.innerHeight / 2) < 2, "the palette is centred down the page");
    const search = palette.querySelector("lc-search");
    search.query = "timeline";
    await until(() => search.querySelector(".search-dropdown .search-result") !== null);
    const dropdown = search.querySelector(".search-dropdown");
    assert.equal(app.win.getComputedStyle(dropdown).position, "static", "the results stay in the palette instead of floating over it");
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
    await until(() => app.$APP.Router.path === "/components/display/badge");
    await until(() => app.doc.querySelector("docs-component h1")?.textContent === "Badge");
    catalogue.select({ id: "skin:neobrutalist", group: "Skins", title: "Neobrutalist", kind: "skin", skin: "neobrutalist" });
    assert.equal(catalogue.skin, "neobrutalist");
  });

  it("dresses the stages in the skin and leaves the chrome alone", async () => {
    await until(() => app.doc.querySelector('lc-example [data-lc-skin="neobrutalist"]') !== null);
    const stage = app.doc.querySelector('lc-example [data-lc-skin="neobrutalist"]');
    await until(() => app.win.getComputedStyle(stage).getPropertyValue("--border-width").trim() === "3px");
    const header = app.doc.querySelector(".shell-header");
    assert.notEqual(app.win.getComputedStyle(header).getPropertyValue("--border-width").trim(), "3px");
    assert.equal(app.doc.querySelector(".shell-skin span").textContent, "Neobrutalist");
  });

  it("offers every preset in the skin menu with the current one checked", async () => {
    await until(() => catalogue.skins.length === presets.length);
    catalogue.chooseSkin("neobrutalist");
    await until(() => app.doc.querySelector(".shell-skin span").textContent === "Neobrutalist");
    const menu = app.doc.querySelector("#docs-skin-menu");
    menu.toggle(app.doc.querySelector(".shell-skin"));
    const checked = () => [...menu.querySelectorAll(".shell-skin-row")].filter((row) => row.getAttribute("aria-checked") === "true").map((row) => row.querySelector("b").textContent);
    await until(() => menu.open === true && checked().includes("Neobrutalist"));
    assert.equal(menu.querySelectorAll(".shell-skin-row").length, presets.length);
    assert.deepEqual(checked(), ["Neobrutalist"]);
    menu.querySelector(".shell-skin-row").click();
    await until(() => catalogue.skin === "");
    await until(() => app.doc.querySelector(".shell-skin span").textContent === "Default");
  });

  it("toggles dark mode from the header", async () => {
    app.doc.querySelector("lc-darkmode button").click();
    await until(() => app.doc.documentElement.classList.contains("dark"));
    app.doc.querySelector("lc-darkmode button").click();
    await until(() => !app.doc.documentElement.classList.contains("dark"));
  });

  it("moves the tree into a drawer on a phone", async () => {
    app.frame.style.width = "390px";
    const shell = app.doc.querySelector("lc-app-shell");
    await until(() => shell.querySelector("[part~=lc-app-shell-menu-button]") !== null);
    shell.querySelector("[part~=lc-app-shell-menu-button]").click();
    await until(() => shell.querySelector("lc-drawer")?.open === true);
    assert.ok(app.doc.querySelector(".shell-nav-skin"));
    assert.ok(app.doc.documentElement.scrollWidth <= 390);
    app.frame.style.width = "1024px";
    await until(() => shell.querySelector("[part~=lc-app-shell-menu-button]") === null);
    assert.deepEqual(app.errors, []);
  });
});
