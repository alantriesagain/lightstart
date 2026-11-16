import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../.light/main.ts";

describe("the fixture app", () => {
  it("renders the root view and adds a note through its controller", async () => {
    const root = document.querySelector("app-root");
    assert.ok(root, "the root view is mounted");
    await (root as unknown as { $requestUpdate(): Promise<void> }).$requestUpdate();
    const button = root.querySelector("button");
    assert.ok(button, "the root view has a button");
    button.click();
    await new Promise((settle) => setTimeout(settle, 300));
    await (root as unknown as { $requestUpdate(): Promise<void> }).$requestUpdate();
    const text = root.textContent ?? "";
    assert.ok(text.includes("note 1"), text);
  });
});
