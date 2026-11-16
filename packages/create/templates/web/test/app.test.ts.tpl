import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../.light/main.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("app-root", () => {
  it("renders the root view and adds a note through its controller", async () => {
    let root = document.querySelector("app-root") as (HTMLElement & { $requestUpdate(): Promise<void> }) | null;
    for (let i = 0; i < 100 && root === null; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      root = document.querySelector("app-root") as (HTMLElement & { $requestUpdate(): Promise<void> }) | null;
    }
    assert.ok(root, "the root view is mounted");
    if (root === null) return;

    await root.$requestUpdate();
    const field = root.querySelector("input");
    assert.ok(field, "the root view has a field");
    if (field === null) return;
    field.value = "first note";
    const button = root.querySelector("lc-button");
    assert.ok(button, "the root view has a button");
    if (button === null) return;
    button.click();

    await settle();
    await root.$requestUpdate();
    const shown = root.textContent ?? "";
    assert.ok(shown.includes("first note"), shown);
  });
});
