/**
 * @file `light lint`: the project's own config, light's recommended config when it has none, and
 * `--fix`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { lintProject } from "../cli/lint.js";

const quiet = { error: () => undefined };

test("lint fails a project whose config rejects a line, and --fix rewrites it", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "light-lint-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "lint-fixture", type: "module" }));
  writeFileSync(join(dir, "eslint.config.js"), 'export default [{ rules: { semi: ["error", "always"] } }];\n');
  const file = join(dir, "source.js");
  writeFileSync(file, "const value = 1\n");
  assert.equal(await lintProject(dir, { log: quiet }), 1);
  assert.equal(await lintProject(dir, { fix: true, log: quiet }), 0);
  assert.equal(readFileSync(file, "utf8"), "const value = 1;\n");
});

test("lint uses light's recommended config when the project has none", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "light-lint-default-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "lint-default", type: "module" }));
  writeFileSync(join(dir, "source.js"), "var value = 1;\n");
  assert.equal(await lintProject(dir, { log: quiet }), 1);
});
