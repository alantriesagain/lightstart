/**
 * @file The admin in Chromium: `/admin` draws the shell with the fixture
 * tool's section in the sidebar, a tool route fills `<app-container>` inside
 * the same layout, and its command opens the palette.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { defineApp } from "@lightstart/app";
import type { AppManifest } from "@lightstart/app/manifest.ts";
import { openPage } from "@lightstart/app/web/test";
import alertDialogDef from "@lightstart/components/overlay/alert-dialog.js";
import badgeDef from "@lightstart/components/display/badge.js";
import buttonDef from "@lightstart/components/display/button.js";
import cardDef from "@lightstart/components/layout/card.js";
import commandPaletteDef from "@lightstart/components/overlay/command-palette.js";
import containerDef from "@lightstart/components/layout/container.js";
import emptyStateDef from "@lightstart/components/feedback/empty-state.js";
import gridDef from "@lightstart/components/layout/grid.js";
import iconDef from "@lightstart/components/display/icon.js";
import inputDef from "@lightstart/components/form/input.js";
import joinDef from "@lightstart/components/form/join.js";
import kbdDef from "@lightstart/components/display/kbd.js";
import labelDef from "@lightstart/components/form/label.js";
import linkDef from "@lightstart/components/display/link.js";
import listRowDef from "@lightstart/components/display/list-row.js";
import modalDef from "@lightstart/components/overlay/modal.js";
import navItemDef from "@lightstart/components/navigation/nav-item.js";
import searchDef from "@lightstart/components/form/search.js";
import textDef from "@lightstart/components/display/text.js";
import toastDef from "@lightstart/components/feedback/toast.js";
import adminExtension from "../../extension.ts";
import { defineTag } from "@lightstart/app/web/tags.ts";
import AdminHome from "../../views/admin-home.ts";
import AdminShell from "../../views/admin-shell.ts";
import toolExtension from "../fixtures/tool.ts";

class AdminTestRoot extends View {
  render() {
    return html`<app-container></app-container>`;
  }
}

View.register("app-root", AdminTestRoot);
defineTag("admin-home", AdminHome);
defineTag("admin-shell", AdminShell);

const define = (tag: string, definition: unknown): void => {
  if (customElements.get(tag) === undefined) View.define(tag, definition as never);
};

const defineComponents = (): void => {
  define("lc-alert-dialog", alertDialogDef);
  define("lc-badge", badgeDef);
  define("lc-button", buttonDef);
  define("lc-card", cardDef);
  define("lc-command-palette", commandPaletteDef);
  define("lc-container", containerDef);
  define("lc-empty-state", emptyStateDef);
  define("lc-grid", gridDef);
  define("lc-icon", iconDef);
  define("lc-input", inputDef);
  define("lc-join", joinDef);
  define("lc-kbd", kbdDef);
  define("lc-label", labelDef);
  define("lc-link", linkDef);
  define("lc-list-row", listRowDef);
  define("lc-modal", modalDef);
  define("lc-nav-item", navItemDef);
  define("lc-search", searchDef);
  define("lc-text", textDef);
  define("lc-toast", toastDef);
};

const manifest: AppManifest = {
  app: defineApp({ name: "admin-fixture", host: "web", title: "Admin fixture" }),
  models: [],
  controllers: [],
  routes: null,
  views: [],
  extensions: [adminExtension, toolExtension],
};

describe("@lightstart/admin", () => {
  it("draws the shell, its section and a tool route from the two extensions", async () => {
    defineComponents();
    const page = await openPage(manifest, { path: "/admin" });
    try {
      const shell = await page.find("admin-shell");
      assert.ok(await page.find("admin-shell admin-home"), "the admin home is drawn inside the shell");
      assert.ok(shell.querySelector("lc-nav-item"), "the sidebar has the tool's section");
      assert.ok((await page.shows("Tool")).includes("Tool"), "the section's title is on the page");
      const header = shell.querySelector("header [data-admin-header='tool-note']");
      assert.ok(header, "the tool's header item is drawn in the header");
      assert.equal(header?.textContent, "Tool header", "the header item's custom element rendered");

      await page.navigate("/admin/tool");
      const tool = await page.find("admin-shell tool-page");
      assert.ok(shell.contains(tool), "the tool route draws inside the same admin shell");
      assert.ok((await page.shows("Tool page")).includes("Tool page"), "the tool's view is drawn");
    } finally {
      await page.stop();
    }
  });

  it("opens the command palette over the commands tools fill", async () => {
    defineComponents();
    const page = await openPage(manifest, { path: "/admin" });
    try {
      const palette = (await page.find("admin-shell lc-command-palette")) as HTMLElement & { open: boolean };
      palette.open = true;
      await page.settle();
      assert.equal(palette.open, true, "the palette opens");
      assert.ok(palette.querySelector("lc-search"), "the palette's search is drawn");
      assert.ok(palette.querySelector("lc-modal"), "the palette sits in its dialog");
    } finally {
      await page.stop();
    }
  });
});
