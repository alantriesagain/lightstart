import { defineRule } from "@lightstart/light/check/define.js";

const ONLY = /\b(?:describe|it|test)\.only\s*\(/;
const TEST_FILE = /^tests?\/.*\.(?:test|e2e)\.(js|ts)$/;

export default defineRule({
  severity: "error",
  description: "a committed test never calls .only",
  why: "`.only` leaves every other test in the file unrun, so a suite that passed locally hides the tests it skipped; it belongs to a debugging session, not to the tree",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!TEST_FILE.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      for (const match of source.matchAll(new RegExp(ONLY.source, "g")))
        ctx.report({ file, offset: /** @type {number} */ (match.index), message: "a committed test calls .only; remove it so the whole file runs" });
    }
  },
});
