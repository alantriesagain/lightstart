import { defineRule } from "@lightstart/light/check/define.js";

/** @param {string} value */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default defineRule({
  severity: "warn",
  description: "a controller has a test that names it",
  why: "a controller holds the writes and the reads a page follows; one no test names is either dead or the part of the app nobody checked, and the fix is a test that reaches it by name",
  check(ctx) {
    const tests = ctx.files().filter((file) => /^tests?\/.*\.(js|ts)$/.test(file));
    for (const file of ctx.files()) {
      const match = /^src\/controllers\/([^/]+)\.(js|ts)$/.exec(file);
      if (!match || /\.test\.(js|ts)$/.test(file)) continue;
      const name = match[1];
      const mentioned = tests.some((test) => {
        const source = ctx.read(test) ?? "";
        return new RegExp(`\\b${escape(name)}\\b`).test(source) || /(?:from\s+["']|import\s*\(\s*["'])[^"']*\.light\/app/.test(source);
      });
      if (!mentioned)
        ctx.report({ file, offset: 0, message: `no file under test/ names the controller "${name}"; add a test that reaches it, or remove the controller` });
    }
  },
});
