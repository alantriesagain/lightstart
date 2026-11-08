import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { mock } from "node:test";
import { check } from "./cli.js";

/**
 * A project named `name` whose one rule throws on import.
 * @param {import("node:test").TestContext} t
 * @param {string} name
 */
const projectWithBrokenRule = (t, name) => {
  const dir = mkdtempSync(path.join(tmpdir(), "light-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, "check", "rules"), { recursive: true });
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, type: "module" }));
  writeFileSync(path.join(dir, "check", "rules", "broken.js"), 'throw new Error("no compiler API");\n');
  return dir;
};

/** @param {string[]} argv */
const run = async (argv) => {
  const log = mock.method(console, "log", () => {});
  try {
    const passed = await check(argv);
    return { passed, lines: log.mock.calls.map((c) => c.arguments.join(" ")) };
  } finally {
    log.mock.restore();
  }
};

test("a rule of light's own that fails to load fails the run, named with its cause", async (t) => {
  const dir = projectWithBrokenRule(t, "light");
  const { passed, lines } = await run([dir]);
  assert.equal(passed, false);
  assert.deepEqual(lines, ["[check] rule light/broken failed to load: no compiler API"]);
});

test("a project's own rule that fails to load stays a warning", async (t) => {
  const dir = projectWithBrokenRule(t, "fx");
  const { passed, lines } = await run([dir]);
  assert.equal(passed, true);
  assert.equal(lines[0], "[check] rule fx/broken failed to load: no compiler API");
  assert.match(lines.at(-1) ?? "", /check passed/);
});
