import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

describe("route layouts", () => {
  it("wraps a view in its layout and keeps the layout element while only the view changes", async () => {
    const page = await openPage(manifest, { path: "/" });
    try {
      const shell = await page.find("app-shell-layout");
      assert.ok(await page.find("app-shell-layout app-home"), "the app default layout wraps the home view");
      await page.navigate("/about");
      await page.shows("About");
      const sameShell = document.querySelector("app-shell-layout");
      assert.equal(sameShell, shell, "the same layout element stays while only the view changes");
      assert.ok(shell.querySelector("app-about"), "the next view is drawn inside the layout");
    } finally {
      await page.stop();
    }
  });

  it("draws a nested child inside its parent view and keeps the parent between its children", async () => {
    const page = await openPage(manifest, { path: "/settings/profile" });
    try {
      const settings = await page.find("app-settings");
      const profile = await page.find("app-settings app-profile");
      assert.ok(settings.contains(profile), "the child view is inside the parent view");
      await page.navigate("/settings/billing");
      await page.shows("Billing");
      assert.equal(document.querySelector("app-settings"), settings, "the parent view element is kept between its children");
      const billing = await page.find("app-billing");
      assert.ok(settings.contains(billing), "the next child is drawn inside the same parent view");
      assert.equal(document.querySelector("app-profile"), null, "the old child is gone");
    } finally {
      await page.stop();
    }
  });

  it("lets a route opt out of the app's layout with layout: null", async () => {
    const page = await openPage(manifest, { path: "/plain" });
    try {
      const plain = await page.find("app-plain");
      assert.equal(plain.closest("app-shell-layout"), null, "the route draws without the app's layout");
      assert.equal(document.querySelector("app-shell-layout"), null);
    } finally {
      await page.stop();
    }
  });

  it("converts a param to the type its view declares", async () => {
    const page = await openPage(manifest, { path: "/item/7" });
    try {
      const item = await page.find("app-item");
      const view = item as unknown as { count: unknown };
      assert.equal(view.count, 7, "the number prop receives a number");
      assert.equal(typeof view.count, "number");
      assert.ok((await page.shows("7 number")).includes("7 number"), "the view renders the number");
      await page.navigate("/item/8");
      await page.shows("8 number");
      assert.equal(document.querySelector("app-item"), item, "a parameter change keeps the view element");
    } finally {
      await page.stop();
    }
  });

  it("sets a route's props and lets a param of the same name win", async () => {
    const page = await openPage(manifest, { path: "/fixed/9" });
    try {
      const fixed = await page.find("app-fixed") as unknown as { label: unknown; count: unknown };
      assert.equal(fixed.label, "fixed", "the route's fixed prop is set");
      assert.equal(fixed.count, 9, "the param wins over the route's prop");
      assert.ok((await page.shows("fixed:9")).includes("fixed:9"), "the view renders both");
    } finally {
      await page.stop();
    }
  });
});
