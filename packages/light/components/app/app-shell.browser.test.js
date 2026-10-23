/**
 * `<lc-app-shell>` with a nav: on desktop the nav and aside are columns
 * beside the content; on a phone the nav waits in a drawer behind a menu
 * button, and the width variables follow what was slotted.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import shellDef from "@bootstrapp/light/components/app/app-shell.js";
import drawerDef from "@bootstrapp/light/components/overlay/drawer.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();

describe("lc-app-shell with a nav column", () => {
  /** @type {any} */
  let el;

  before(async () => {
    define("lc-drawer", drawerDef);
    define("lc-app-shell", shellDef);
    el = document.createElement("lc-app-shell");
    el.layout = "desktop";
    el.navWidth = "12rem";
    el.innerHTML = `<nav slot="nav">Sections</nav><div>Page</div><aside slot="aside">On this page</aside>`;
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => el.remove());

  it("lays the nav and aside out as columns on desktop", () => {
    const container = el.querySelector("[part~=lc-app-shell-container]");
    assert.ok(el.querySelector('[part~=lc-app-shell-nav] slot[name="nav"]'));
    assert.ok(el.querySelector('[part~=lc-app-shell-aside] slot[name="aside"]'));
    assert.match(container.getAttribute("style"), /--lc-app-shell-nav-width: 12rem/);
  });

  it("puts the nav in a drawer behind a menu button on a phone", async () => {
    el.layout = "mobile";
    await rendered(el);
    const button = el.querySelector("[part~=lc-app-shell-menu-button]");
    assert.ok(button, "a menu button is drawn");
    assert.equal(button.getAttribute("aria-label"), "Open navigation");
    const drawer = el.querySelector("lc-drawer");
    assert.ok(drawer, "the nav sits in a drawer");
    assert.equal(el.navOpen, false);
    /** @type {any[]} */
    const toggles = [];
    el.addEventListener("nav-toggle", (e) => toggles.push(e.detail.open));
    button.click();
    await rendered(el);
    assert.equal(el.navOpen, true);
    assert.deepEqual(toggles, [true]);
  });
});
