// node-only
/**
 * @file Runs the admin's browser test through `light test`, one file at a
 * time, so `light test @lightstart/admin` covers it beside the node tests.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { done, eqn } from "@lightstart/test/assert.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const run = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/browser/admin.browser.test.ts"], { cwd: packageDir, env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8" });
eqn("the admin browser test passes", run.status ?? 1, 0);
if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
done();
