import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

let cleanups = 0;

describe("cleanup after failure", () => {
  afterEach(() => { cleanups += 1; });

  it("fails on purpose", () => {
    assert.equal(1, 2);
  });

  it("sees the previous cleanup", () => {
    assert.equal(cleanups, 1);
  });
});
