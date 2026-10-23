import test from "node:test";
import { RuleTester } from "eslint";
import rule from "./no-non-jsdoc-comments.js";

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

test("no-non-jsdoc-comments", () => {
  ruleTester.run("no-non-jsdoc-comments", rule, {
    valid: [
      { code: "/** The active database handle. */\nexport const db = {};" },
      { code: "/** @param {number} a */\nfunction f(a) { return a; }" },
      { code: "/** Whichever of black or white contrasts more, by the WCAG ratio. */\nexport const pick = () => {};" },

      { code: "/** Migrate legacy timelines into the flat layer format. */\nexport const migrate = () => {};" },
      { code: "/** An opaque id used to link translation variants. */\nexport const id = 1;" },
      { code: "/** Returns srcCanvas unchanged if WebGL is unavailable. */\nexport const run = () => {};" },
      { code: "/** Simple chart for displaying historical stats data. */\nexport const chart = 1;" },

      { code: "// @ts-nocheck\nconst a = 1;" },
      { code: "// eslint-disable-next-line no-unused-vars\nconst a = 1;" },
      { code: "/** @type {any} */ (x);" },
    ],
    invalid: [
      {
        code: "/** Compatibility re-export (previously inlined this). */\nexport const x = 1;",
        errors: [{ messageId: "history" }],
      },
      {
        code: "/** The live-state half of what deps used to be. */\nexport const y = 1;",
        errors: [{ messageId: "history" }],
      },
      {
        code: "/** Back-compat alias for the old name. */\nexport const z = 1;",
        errors: [{ messageId: "history" }],
      },
      {
        code: "/** Re-exported so existing importers are unchanged. */\nexport const w = 1;",
        errors: [{ messageId: "history" }],
      },
      {
        code: "try { run(); } catch { /** already handled */ }",
        errors: [{ messageId: "placeholder" }],
      },
      {
        code: "// a stray note\nconst a = 1;",
        output: "const a = 1;",
        errors: [{ messageId: "forbidden" }],
      },
      {
        code: "/* a block note */\nconst a = 1;",
        output: "const a = 1;",
        errors: [{ messageId: "forbidden" }],
      },
      {
        code: "export default {\n  /** Back to whatever the exercise itself says. */\n  reset() {},\n};",
        output: "export default {\n  reset() {},\n};",
        errors: [{ messageId: "internalProse" }],
      },
      {
        code: "/** header */\nimport x from \"x\";\n/** A projection list. */\nconst FIELDS = [];\nexport { FIELDS, x };",
        output: "/** header */\nimport x from \"x\";\nconst FIELDS = [];\nexport { FIELDS, x };",
        errors: [{ messageId: "internalProse" }],
      },
      {
        code: "const t = html`<div><!-- Profile Header --><span>${x}</span></div>`;",
        output: "const t = html`<div><span>${x}</span></div>`;",
        errors: [{ messageId: "templateComment" }],
      },
      {
        code: "const t = html`<div>${a}<!-- one --><i>${b}</i><!-- two --></div>`;",
        output: "const t = html`<div>${a}<i>${b}</i></div>`;",
        errors: [{ messageId: "templateComment" }, { messageId: "templateComment" }],
      },
    ],
  });
});

test("no-non-jsdoc-comments allows headers, export docs, and typed internals", () => {
  ruleTester.run("no-non-jsdoc-comments", rule, {
    valid: [
      { code: "/** The module header, before anything. */\nimport x from \"x\";\nexport { x };" },
      { code: "/** Documents the export. */\nexport const db = {};" },
      { code: "/** Documents the default export. */\nexport default { a: 1 };" },
      { code: "export default {\n  /** @param {number} n */\n  bump(n) { return n + 1; },\n};" },
      { code: "const rows = /** @type {string[]} */ ([]);\nexport { rows };" },
      { code: "const s = `not html <!-- kept -->`;\nexport { s };" },
      { code: "const t = css`<!-- kept -->`;\nexport { t };" },
    ],
    invalid: [],
  });
});
