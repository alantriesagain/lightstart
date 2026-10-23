import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ESLint } from "eslint";
import light from "./index.js";

const SOURCE = `import { defineComponent } from "@bootstrapp/light";
import T from "@bootstrapp/light/types";
export default defineComponent({ tag: "fx-card", props: { click: T.function() }, render() { return null; } });
`;

const project = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "light-eslint-"));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture", type: "module", bootstrapp: { components: { fx: "views/" } } }));
  mkdirSync(path.join(dir, "views"));
  writeFileSync(path.join(dir, "views", "card.js"), SOURCE);
  return dir;
};

/** @param {string} cwd */
const linter = (cwd) =>
  new ESLint({ cwd, overrideConfigFile: true, overrideConfig: [{ files: ["**/*.js"], plugins: { light }, rules: { "light/check-errors": "error", "light/check-warnings": "warn" } }] });

test("a finding of the checker is an eslint message at its line and column, with the checker's rule id", async (t) => {
  const dir = project();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const [result] = await linter(dir).lintFiles(["views/card.js"]);
  const messages = result.messages.filter((m) => m.ruleId?.startsWith("light/check"));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "light/check-errors");
  assert.match(messages[0].message, /shadows the DOM's click\(\) on <fx-card>; rename it \(light\/no-dom-member-shadowing\)$/);
  assert.equal(messages[0].line, 3);
  assert.equal(messages[0].column, SOURCE.split("\n")[2].indexOf("props:") + 1);
});

test("an unsaved buffer stands in for the file, and the file returns when the buffer does", async (t) => {
  const dir = project();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const eslint = linter(dir);
  const filePath = path.join(dir, "views", "card.js");
  const [renamed] = await eslint.lintText(SOURCE.replace("click", "pick"), { filePath });
  assert.deepEqual(renamed.messages.filter((m) => m.ruleId?.startsWith("light/check")), []);
  const [original] = await eslint.lintText(SOURCE, { filePath });
  assert.equal(original.messages.filter((m) => m.ruleId === "light/check-errors").length, 1);
});

test("a file with no package.json above it is left alone", async () => {
  const [result] = await linter(tmpdir()).lintText(SOURCE, { filePath: path.join(path.parse(tmpdir()).root, "light-eslint-nowhere", "card.js") });
  assert.deepEqual(result.messages.filter((m) => m.ruleId?.startsWith("light/check")), []);
});
