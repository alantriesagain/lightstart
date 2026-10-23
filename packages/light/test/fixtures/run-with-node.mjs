/**
 * Runs one fixture under the REAL `node:test` and prints its outcome table as
 * JSON (the same shape `run-with-shim.mjs` prints). Spawned as a child so the
 * node runner is never nested inside another node runner.
 */
import { run } from "node:test";

const [, , fixture] = process.argv;

const rows = [];
const counts = { pass: 0, fail: 0, skip: 0, todo: 0, total: 0, suites: 0 };

const stream = run({ files: [fixture], isolation: "none" });
for await (const event of stream) {
  if (event.type !== "test:pass" && event.type !== "test:fail") continue;
  if (event.data.details?.type === "suite") {
    counts.suites += 1;
    continue;
  }
  const status = event.data.skip ? "skip"
    : event.data.todo ? "todo"
      : event.type === "test:pass" ? "pass" : "fail";
  rows.push({ name: event.data.name, status });
  counts[status] += 1;
  counts.total += 1;
}

process.stdout.write(JSON.stringify({ counts, rows }, null, 2));
