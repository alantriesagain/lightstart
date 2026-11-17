import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineApp } from "@lightstart/app";
import type { AppManifest } from "@lightstart/app/manifest.ts";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

describe("openPage", () => {
  it("mounts the root view at a path and adds a note through its controller", async () => {
    const page = await openPage(manifest, { path: "/about" });
    try {
      assert.equal(page.root.tagName.toLowerCase(), "app-root");
      assert.ok((await page.shows("About")).includes("About"), "the about route is drawn");

      const button = await page.find("app-root button");
      button.click();
      assert.ok((await page.shows("note 1")).includes("note 1"), "the note is listed");
    } finally {
      await page.stop();
    }
  });

  it("takes its arguments from the test and goes to another route", async () => {
    const withArgs = defineApp({ name: "fixture-web", host: "web", args: { greeting: { default: "hi" } } });
    const page = await openPage({ ...manifest, app: withArgs } as AppManifest, { args: { greeting: "hello" } });
    try {
      assert.equal(page.run.app.args.string("greeting"), "hello");
      await page.navigate("/");
      assert.ok((await page.shows("Home")).includes("Home"), "the home route is drawn");
      await page.navigate("/about");
      assert.ok((await page.shows("About")).includes("About"), "and the about route again");
    } finally {
      await page.stop();
    }
  });

  it("removes the root element when it stops", async () => {
    const page = await openPage(manifest);
    const root = page.root;
    await page.stop();
    assert.equal(root.isConnected, false);
    assert.equal(document.querySelector("app-root"), null);
  });
});
