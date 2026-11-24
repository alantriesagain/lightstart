// node-only
/**
 * @file `<app-slot>` in headless Chromium, run through `light test` one file
 * per run: `web-slot.browser.ts` draws a slot's items by their tags in order
 * with the context set, adds and takes away an element as the slot is filled
 * and withdrawn, and draws nothing for an empty slot.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { done, eqn } from "@lightstart/test/assert.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const run = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/web-slot.browser.ts"], { cwd: packageDir, env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8" });
eqn("the <app-slot> browser test passes", run.status ?? 1, 0);
if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
done();
