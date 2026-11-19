import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.js";

describe("openPage on a JavaScript app", () => {
  it("mounts the root view and shows the home view", async () => {
    const page = await openPage(manifest);
    try {
      assert.equal(page.root.tagName.toLowerCase(), "app-root");
      assert.ok((await page.shows("Home")).includes("Home"), "the home route is drawn");
      assert.ok((await page.shows("Seeded note")).includes("Seeded note"), "the seed's row is drawn");
    } finally {
      await page.stop();
    }
  });
});
