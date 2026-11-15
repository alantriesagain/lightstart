import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/main.ts";

describe("app-root", () => {
  it("counts clicks", async () => {
    const root = document.createElement("app-root") as HTMLElement & { $requestUpdate(): Promise<void> };
    document.body.append(root);
    await root.$requestUpdate();
    const button = root.querySelector("button");
    assert.ok(button, "the page has a button");
    button.click();
    await root.$requestUpdate();
    assert.ok((root.textContent ?? "").includes("Count: 1"), "the button counts the click");
    root.remove();
  });
});
