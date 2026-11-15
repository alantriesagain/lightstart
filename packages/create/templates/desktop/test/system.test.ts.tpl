import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { machine } from "../system.ts";

describe("machine", () => {
  it("reports this platform", () => {
    assert.equal(machine().platform, process.platform);
  });

  it("reports a home directory as text", () => {
    const info = machine();
    assert.equal(typeof info.home, "string");
    if (process.env["HOME"] !== undefined) assert.equal(info.home, process.env["HOME"]);
  });
});
