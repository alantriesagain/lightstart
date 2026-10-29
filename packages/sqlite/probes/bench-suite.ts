/**
 * @file The driver benchmark both runtimes run: a point read, a 100-row JSON
 * answer, one insert per transaction and 100 inserts in one transaction, over
 * `:memory:` so the numbers are engine work and not the disk.
 */
import type { SqlDatabase } from "../index.ts";

const time = (label: string, count: number, fn: (index: number) => void): void => {
  const start = Date.now();
  for (let index = 0; index < count; index++) fn(index);
  const seconds = (Date.now() - start) / 1000;
  console.log(label + "\t" + String(Math.round(count / seconds)) + " ops/s");
};

/** Run the checks with a named driver's `open`. */
export const runBench = (name: string, open: () => SqlDatabase): void => {
  const db = open();
  db.exec("CREATE TABLE note (id TEXT PRIMARY KEY, n INTEGER NOT NULL, tags TEXT)");
  const insert = db.prepare("INSERT INTO note (id, n, tags) VALUES (?, ?, ?)");
  db.transaction(() => {
    for (let index = 0; index < 1000; index++) insert.run([`r${index}`, index, '["a","b"]']);
  });
  const point = db.prepare("SELECT * FROM note WHERE id = ?");
  const page = db.prepare("SELECT * FROM note LIMIT 100");
  const one = db.prepare("INSERT INTO note (id, n, tags) VALUES (?, ?, ?)");
  console.log(name);
  time("point read", 100000, () => { point.get(["r500"]); });
  time("100-row json", 10000, () => { page.json(); });
  time("insert in its transaction", 10000, (index) => {
    db.transaction(() => { one.run([`t${index}`, index, "[]"]); });
  });
  time("100 inserts in one transaction", 1000, (index) => {
    db.transaction(() => {
      for (let at = 0; at < 100; at++) one.run([`g${index}-${at}`, at, "[]"]);
    });
  });
  db.close();
};
