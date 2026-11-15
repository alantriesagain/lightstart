// node-only
/**
 * @file The node stand-in gives a call four budgets, because its timer cannot pause while the
 * core works. A child process preloads it and runs a 15 ms loop, past the engine's 10 ms budget and
 * far enough inside that allowance for a loaded machine; QuickJS would stop it at 10 ms.
 */
import { spawnSync } from "node:child_process";
import { done, eq } from "@light/test/assert.ts";

const script = `
const h = wcjsNew(16, 10);
wcjsEval(h, "const t = Date.now(); while (Date.now() - t < 15) {}", "loop.js", (status) => console.log("status", status));
`;
const run = spawnSync(process.execPath, ["--import", "./native/wcjs-node.mjs", "-e", script], { cwd: process.cwd(), encoding: "utf8" });
eq("the node stand-in allows four budgets", (run.stdout ?? "").trim(), "status 0");
done();
