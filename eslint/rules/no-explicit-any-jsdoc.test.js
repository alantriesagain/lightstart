import test from "node:test";
import { RuleTester } from "eslint";
import rule from "./no-explicit-any-jsdoc.js";

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

test("no-explicit-any-jsdoc", () => {
  ruleTester.run("no-explicit-any-jsdoc", rule, {
    valid: [
      { code: "/** @param {unknown} x */\nexport const f = (x) => x;" },
      { code: "/** Accepts any value the caller has. */\nexport const g = (x) => x;" },
      { code: "// @type {any}\nconst a = 1;" },
      { code: "/* @type {any} */\nconst b = 1;" },
      { code: "/** @type {Anything} */\nconst c = 1;" },
      { code: "/** Accepts {any} value, as prose. */\nexport const p = (x) => x;" },
      { code: "/** @type {T.any} */\nconst q = 1;" },
    ],
    invalid: [
      { code: "/** @type {any} */\nconst d = 1;", errors: [{ messageId: "forbidden" }] },
      { code: "/** @param {Record<string, any>} o */\nexport const h = (o) => o;", errors: [{ messageId: "forbidden" }] },
      { code: "/** @returns {Promise<any>} */\nexport const i = async () => 1;", errors: [{ messageId: "forbidden" }] },
      { code: "/** @typedef {any} X */", errors: [{ messageId: "forbidden" }] },
      { code: "/** @param {{ a: { b: any } }} o */\nexport const j = (o) => o;", errors: [{ messageId: "forbidden" }] },
      { code: "class K {\n  /** @this {any} */\n  m() {}\n}", errors: [{ messageId: "forbidden" }] },
      { code: "/** @type {*} */\nconst k = 1;", errors: [{ messageId: "forbidden" }] },
      { code: "/**\n * @param {any} a\n * @param {any} b\n */\nexport const l = (a, b) => a;", errors: [{ messageId: "forbidden" }] },
    ],
  });
});
