/**
 * @file Probe X: many directory watchers at once, the shape a recursive watch takes when `fs.watch`
 * has no `recursive` option: 600 directories each with its own watcher, a write into the last one,
 * a watched directory removed under its watcher, then every watcher closed. Prints booleans only,
 * since inotify may coalesce events differently from run to run.
 */
import { mkdirSync, rmSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(tmpdir(), "light-probe-x");
rmSync(root, { recursive: true, force: true });
const COUNT = 600;
/**
 * A watcher handle has no dynamic representation, not even inside a class instance, so a collection
 * holds a closure over it: functions convert into collection slots and keep their identity (a
 * `Map` of functions has no `size` natively; count while iterating).
 * @type {Map<string, () => void>}
 */
const closers = new Map();
/** @type {number[]} */
const events = [];
for (let i = 0; i < COUNT; i++) {
  const dir = join(root, "d" + String(i));
  mkdirSync(dir, { recursive: true });
  events.push(0);
}
for (let i = 0; i < COUNT; i++) {
  const index = i;
  const dir = join(root, "d" + String(i));
  const watcher = watch(dir, (/** @type {string} */ eventType) => {
    events[index] += eventType.length > 0 ? 1 : 0;
  });
  closers.set(dir, () => watcher.close());
}
let count = 0;
for (const close of closers.values()) count += close === null ? 0 : 1;
console.log("watching", count);
setTimeout(() => {
  writeFileSync(join(root, "d" + String(COUNT - 1), "file.txt"), "x");
  writeFileSync(join(root, "d0", "file.txt"), "y");
  setTimeout(() => {
    console.log("last fired", events[COUNT - 1] > 0, "first fired", events[0] > 0, "middle quiet", events[300] === 0);
    rmSync(join(root, "d1"), { recursive: true, force: true });
    setTimeout(() => {
      let closed = 0;
      for (const close of closers.values()) {
        close();
        closed++;
      }
      console.log("closed", closed);
      writeFileSync(join(root, "d2", "late.txt"), "z");
      setTimeout(() => {
        console.log("after close quiet", events[2] === 0);
        rmSync(root, { recursive: true, force: true });
        console.log("done");
      }, 200);
    }, 200);
  }, 300);
}, 100);
