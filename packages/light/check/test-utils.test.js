import assert from "node:assert/strict";
import test from "node:test";
import { appliesOn, runRuleOn } from "./test-utils.js";

const gated = {
  severity: "warn",
  description: "fires on tailwind projects with a marker file",
  appliesTo: { styling: "tailwind", when: (ctx) => ctx.files().includes("marker.js") },
  check(ctx) {
    ctx.report({ file: "marker.js", offset: 3, message: "seen" });
  },
};
const tailwind = { host: { styling: "tailwind" } };

test("runRuleOn runs the body and resolves offsets; appliesOn names the gate's reason", async () => {
  assert.deepEqual(await runRuleOn(gated, { "marker.js": "ab\ncd" }, tailwind), [{ severity: "warn", file: "marker.js", line: 2, col: 1, message: "seen" }]);
  assert.deepEqual((await runRuleOn(gated, { "marker.js": "" })).map((f) => f.message), ["seen"]);
  assert.equal(appliesOn(gated, { "marker.js": "" }), "tailwind-only");
  assert.equal(appliesOn(gated, {}, tailwind), "config-gated");
  assert.equal(appliesOn(gated, { "marker.js": "" }, tailwind), null);
});
