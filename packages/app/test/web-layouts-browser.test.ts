// node-only
/**
 * @file The web fixture's layout browser test run through `light test`, one
 * file per run: the app's default layout wraps a top-level route, a routed
 * view draws its children, `layout: null` opts out, and route params and props
 * reach the view.
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));
const env = { ...process.env, LIGHT_PROJECT_DIR: fixture, NO_COLOR: "1" };

const main = async (): Promise<void> => {
  rmSync(join(fixture, ".light"), { recursive: true, force: true });
  try {
    const run = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/layouts.browser.test.ts"], { cwd: fixture, env, encoding: "utf8" });
    eqn("the web fixture's layout browser test passes", run.status ?? 1, 0);
    if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
  } finally {
    rmSync(join(fixture, ".light"), { recursive: true, force: true });
  }
  done();
};

await main();
