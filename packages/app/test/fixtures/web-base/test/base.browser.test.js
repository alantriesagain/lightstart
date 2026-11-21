import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appUrl } from "@lightstart/app";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.js";

describe("links under the app's base", () => {
  it("keeps root-relative hrefs under the base, before and after mount, and leaves the others", async () => {
    const page = await openPage(manifest, { path: "/" });
    try {
      assert.equal((await page.find("#about")).getAttribute("href"), "/budget/about");
      assert.equal((await page.find("#external")).getAttribute("href"), "/docs");
      assert.equal((await page.find("#raw")).getAttribute("href"), "/raw");
      const late = document.createElement("a");
      late.id = "late";
      late.setAttribute("href", "/about");
      page.root.append(late);
      await page.settle();
      assert.equal(late.getAttribute("href"), "/budget/about");
      await page.navigate("/about");
      await page.shows("About");
      assert.equal(page.run.router?.path, "/about");
      assert.equal((await page.find("#home")).getAttribute("href"), "/budget/");
    } finally {
      await page.stop();
    }
  });

  it("appUrl puts the base before a root-relative path, and the test server answers it", async () => {
    assert.equal(appUrl("/rates.json"), "/budget/rates.json");
    assert.equal((await fetch(appUrl("/rates.json"))).ok, true);
    assert.equal(appUrl("https://example.com/x"), "https://example.com/x");
  });
});
