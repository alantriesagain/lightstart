// node-only
/**
 * @file A log path that cannot be opened is said once on stderr and turns the log off. A child
 * process keeps that stderr out of the test runner's output comparison.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@light/test/assert.ts";

const dir = mkdtempSync(join(tmpdir(), "tui-log-bad-"));
const path = join(dir, "missing", "run.log");
const script = `import { openLog, logPath, log } from "./log.ts"; openLog(${JSON.stringify(path)}); log("ignored"); console.log("path=" + logPath());`;
const run = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], { cwd: process.cwd(), encoding: "utf8" });
eq("the log stays off", (run.stdout ?? "").trim(), "path=");
ok("the failure is said once", (run.stderr ?? "").includes("cannot log to " + path));
rmSync(dir, { recursive: true, force: true });
done();
