/**
 * @file The file, log and process helpers: a whole write that never shares a temp name and cleans it
 * after a failed rename, a log that can be turned off without throwing, a child's stderr capped
 * like its stdout, and a run past its time answered at once.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAtomic } from "../fs.ts";
import { log, openLog } from "../log.ts";
import { SpawnOptions, spawnCapped } from "../process.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const main = async (): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "tui-lib-io-"));
  try {
    const path = join(dir, "a", "b.txt");
    writeAtomic(path, "one");
    eq("a write makes the folder and the whole text", readFileSync(path, "utf8"), "one");
    writeAtomic(path, "two");
    eq("a second write replaces it", readFileSync(path, "utf8"), "two");
    ok("no temp file is left", !readdirSync(join(dir, "a")).some((n) => n.endsWith(".tmp")));

    const target = join(dir, "target");
    mkdirSync(target);
    let threw = false;
    try {
      writeAtomic(target, "no");
    } catch {
      threw = true;
    }
    ok("a write that cannot rename throws", threw);
    ok("and leaves no temp file", !readdirSync(dir).some((n) => n.startsWith("target.") && n.endsWith(".tmp")));

    const logPath = join(dir, "run.log");
    openLog(logPath);
    log("hello");
    ok("the log keeps its lines", readFileSync(logPath, "utf8").includes("hello"));
    openLog(null);
    log("nothing");

    const o = new SpawnOptions();
    o.maxBytes = 1024;
    o.timeoutMs = 5000;
    const run = await spawnCapped("sh", ["-c", "head -c 200000 /dev/zero | tr '\\0' x >&2"], o);
    ok("a child's stderr is capped like its stdout", run.errOut.length <= 1024 && run.truncated);

    const late = new SpawnOptions();
    late.maxBytes = 1024;
    late.timeoutMs = 100;
    const started = Date.now();
    const timed = await spawnCapped("sh", ["-c", "trap '' TERM; sleep 0.2"], late);
    ok("a run past its time is answered at once", timed.timedOut && Date.now() - started < 3000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  done();
};

main().catch((err: unknown) => {
  console.log("FAIL " + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
