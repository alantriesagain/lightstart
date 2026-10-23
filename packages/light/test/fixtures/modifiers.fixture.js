import assert from "node:assert/strict";
import { skip, test, todo } from "node:test";

test("ordinary", () => assert.ok(true));

skip("skipped through the standalone export", () => {
  throw new Error("must never run");
});

todo("todo through the standalone export");
