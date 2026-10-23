import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixtures = readdirSync(dir).filter((name) => name.endsWith(".fixture.js"));

/**
 * @param {string} runner @param {string} fixture
 * @returns {{ rows: { name: string, status: string }[], loadError?: unknown }}
 */
const outcomesFrom = (runner, fixture) => {
  const { stdout, stderr, status } = spawnSync(
    process.execPath,
    [join(dir, runner), join(dir, fixture)],
    { encoding: "utf-8" },
  );
  assert.equal(status, 0, `${runner} failed for ${fixture}:\n${stderr}`);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.loadError ?? null, null, `${fixture} failed to load under ${runner}: ${parsed.loadError}`);
  return parsed;
};

/** @param {string} fixture @returns {Map<string | undefined, string>} */
const nodeOutcomes = (fixture) => {
  /** @type {Map<string | undefined, string>} */
  const outcomes = new Map();
  for (const row of outcomesFrom("run-with-node.mjs", fixture).rows) outcomes.set(row.name, row.status);
  return outcomes;
};

/** @param {string} fixture @returns {Map<string | undefined, string>} */
const shimOutcomes = (fixture) => {
  /** @type {Map<string | undefined, string>} */
  const outcomes = new Map();
  for (const row of outcomesFrom("run-with-shim.mjs", fixture).rows)
    outcomes.set(row.name.split(" > ").pop(), row.status);
  return outcomes;
};

for (const fixture of fixtures)
  test(`parity: ${fixture}`, () => {
    const expected = nodeOutcomes(fixture);
    const actual = shimOutcomes(fixture);

    assert.equal(expected.size > 0, true, `${fixture} produced no node outcomes to compare`);

    for (const [name, status] of expected) {
      assert.equal(
        actual.has(name),
        true,
        `${fixture}: "${name}" ran under node --test but not under the shim`,
      );
      assert.equal(
        actual.get(name),
        status,
        `${fixture}: "${name}" is ${actual.get(name)} under the shim, ${status} under node --test`,
      );
    }

    for (const name of actual.keys())
      assert.equal(expected.has(name), true, `${fixture}: "${name}" ran under the shim but not under node --test`);
  });
