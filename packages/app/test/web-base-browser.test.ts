// node-only
/**
 * @file The based fixture's browser test run through `light test`, so the web
 * host's link observer rewrites a link drawn before and after mount, while an
 * external or `data-no-router` link stays as written.
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-base", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));
const env = { ...process.env, LIGHT_PROJECT_DIR: fixture, NO_COLOR: "1" };

const main = async (): Promise<void> => {
  rmSync(join(fixture, ".light"), { recursive: true, force: true });
  try {
    const run = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/base.browser.test.js"], { cwd: fixture, env, encoding: "utf8" });
    eqn("the based fixture's browser test passes", run.status ?? 1, 0);
    if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
  } finally {
    rmSync(join(fixture, ".light"), { recursive: true, force: true });
  }
  done();
};

await main();
