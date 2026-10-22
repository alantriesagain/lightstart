// node-only
/**
 * @file The real C shim, not the node stand-in. It builds libwcjs.a, compiles a small driver
 * that rejects a promise, and checks the job pump reports it once.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { done, eq, ok } from "@light/test/assert.ts";

const cwd = process.cwd();
const quickjs = process.env["QUICKJS_DIR"] ?? join(cwd, "../../../../scriptc/packages/runtime/vendor/quickjs-ng");
const build = spawnSync("bash", ["native/build.sh"], { cwd, encoding: "utf8" });
ok("the native shim builds", build.status === 0);
const dir = mkdtempSync(join(tmpdir(), "plugins-rejection-"));
const exe = join(dir, "rejection");
const compile = spawnSync("cc", ["-std=gnu11", "-D_GNU_SOURCE", "-I", quickjs, "native/rejection_test.c", "native/out/libwcjs.a", "-lm", "-ldl", "-lpthread", "-o", exe], { cwd, encoding: "utf8" });
ok("the native driver compiles", compile.status === 0);
const run = spawnSync(exe, [], { encoding: "utf8" });
eq("the job pump reports the rejection", (run.stdout ?? "").trim(), "eval=0 jobs=1 text=Error: unhandled from a plugin");
rmSync(dir, { recursive: true, force: true });
done();
