import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppManifest } from "@lightstart/app/manifest.ts";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

describe("a form whose controls are defined on demand", () => {
  it("draws its inputs, and typing into one reaches the form's value", async () => {
    const page = await openPage(manifest as AppManifest, { path: "/form" });
    try {
      const input = await page.find("app-form lc-form lc-input input") as HTMLInputElement;
      const checkbox = await page.find("app-form lc-form lc-checkbox input") as HTMLInputElement;
      input.value = "A place";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.click();
      await page.settle();

      const form = document.querySelector("app-form lc-form") as HTMLElement & {
        collectFormData(): Record<string, unknown>;
      };
      assert.deepEqual(form.collectFormData(), { title: "A place", live: true });
    } finally {
      await page.stop();
    }
  });
});
