/**
 * @file The log and the trail: a run's own file in a folder, named by its time and process id, the oldest
 * ones pruned to the number kept; a log past its cap stops with a last line; the trail keeps the
 * latest top-level happenings, the same one in a row counted, what is open at a moment (a crash's
 * place), a nested entry open but not kept, a depth healed by leave and reset.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@light/test/assert.ts";
import { Trail, log, logPath, openLog, openLogIn } from "../log.ts";

const dir = mkdtempSync(join(tmpdir(), "tui-log-"));
for (const n of ["2026-01-01T00-00-00-1.log", "2026-01-02T00-00-00-2.log", "2026-01-03T00-00-00-3.log", "notes.txt"]) writeFileSync(join(dir, n), "old\n");
const p = openLogIn(join(dir, "logs"), 3);
ok("a folder made, the run's file in it, named by its time and process id", p.startsWith(join(dir, "logs") + "/") && p.endsWith("-" + String(process.pid) + ".log") && logPath() === p);
log("hello");
ok("its lines go there", readFileSync(p, "utf8").includes(" hello\n"));
const kept = openLogIn(dir, 3);
const names = readdirSync(dir).sort();
eq("the oldest logs pruned so that the number kept remain with this one; other files left", names.join(","), "2026-01-02T00-00-00-2.log,2026-01-03T00-00-00-3.log," + kept.slice(dir.length + 1) + ",logs,notes.txt");

openLog(join(dir, "again.log"));
log("and a later path works");
ok("opening a later path works", readFileSync(join(dir, "again.log"), "utf8").includes(" and a later path works"));

const capped = join(dir, "capped.log");
openLog(capped, 200);
for (let i = 0; i < 20; i++) log("line " + String(i));
const text = readFileSync(capped, "utf8");
ok("past its cap the log stops, with a last line saying so", text.length < 400 && text.includes("the log reached its cap") && !text.includes("line 19") && logPath() === "");
openLog(null);

const t = new Trail();
const a = t.enter("key", "enter");
const b = t.enter("plugin", "claude");
eq("open: outermost first; a nested entry is open", t.open(), "key enter > plugin claude");
t.leave(b);
t.leave(a);
for (let i = 0; i < 3; i++) {
  const d = t.enter("plugin", "claude");
  t.leave(d);
}
const f = t.within("frame", "render");
t.leave(f);
const lines = t.text().split("\n");
eq("nothing open; the latest kept, the same in a row counted, the nested and the frame not kept", [lines[0], lines.slice(2).map((l) => l.trim().replace(/^\d+ /, "")).join(",")].join(" | "), "open: nothing | key enter,plugin claude ×3");
t.enter("frame", "views");
t.enter("plugin", "status");
t.enter("events", "text");
eq("a crash finds open what it happened in", t.open(), "frame views > plugin status > events text");
t.reset();
eq("a top-level boundary heals the depth an exception left", t.open() + "|" + String(t.enter("key", "x")), "|0");
const deep = new Trail();
for (let i = 0; i < 40; i++) deep.enter("call", String(i));
ok("past its depth the trail says how many more", deep.open().endsWith("… 8 more"));
const ring = new Trail();
for (let i = 0; i < 200; i++) ring.leave(ring.enter("key", String(i)));
const kept2 = ring.text().split("\n").slice(2);
ok("the latest are kept, the oldest dropped", kept2.length === 96 && kept2[0].endsWith(" key 104") && kept2[95].endsWith(" key 199"));

rmSync(dir, { recursive: true, force: true });
done();
