// node-only
/**
 * @file The worker fixture's browser test run through `light test`, so the
 * package's own gate reaches the worker in Chromium.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { done, eqn } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/worker", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));
const env = { ...process.env, LIGHT_PROJECT_DIR: fixture, NO_COLOR: "1" };

const main = async (): Promise<void> => {
  const run = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/worker.browser.test.js"], { cwd: fixture, env, encoding: "utf8" });
  eqn("light test runs the worker fixture's browser test", run.status ?? 1, 0);
  if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
  done();
};

await main();
