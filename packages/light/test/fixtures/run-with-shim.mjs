/**
 * Loads one fixture with `node:test` / `node:assert/strict` redirected to the
 * browser shims, runs it through the harness, and prints the outcome table as
 * JSON. `parity.test.js` compares that against the same fixture under the real
 * `node --test`.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const [, , fixture] = process.argv;
const here = new URL("./", import.meta.url);

register(new URL("./shim-loader.mjs", here));

const { reset, run } = await import(new URL("../harness.js", here).href);
reset();

let loadError = null;
try {
  await import(pathToFileURL(fixture).href);
} catch (error) {
  loadError = error;
}

const { results, counts } = await run();

const flatten = (result) => [
  { name: result.name.join(" > "), status: result.status, isSuite: result.isSuite ?? false },
  ...result.subtests.flatMap(flatten),
];
const rows = results.flatMap(flatten).filter((row) => !row.isSuite);

process.stdout.write(JSON.stringify({ loadError: loadError?.message ?? null, counts, rows }, null, 2));
