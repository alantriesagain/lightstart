import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

describe("app-root", () => {
  it("renders the root view and adds a note through its controller", async () => {
    const page = await openPage(manifest);
    try {
      const field = await page.find("input");
      assert.ok(field instanceof HTMLInputElement, "the root view has a field");
      field.value = "first note";
      const form = await page.find("app-root form");
      assert.ok(form instanceof HTMLFormElement, "the root view has a form");
      form.requestSubmit();
      const shown = await page.shows("first note");
      assert.ok(shown.includes("first note"), shown);
    } finally {
      await page.stop();
    }
  });
});
