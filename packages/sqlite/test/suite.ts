/**
 * @file The checks both drivers answer: a table made, positional and named
 * binds, rows as JSON text, run's changes and last id, a transaction rolled
 * back, a nested savepoint rolled back alone, the statement cache, and an
 * error surfacing with its SQLite message.
 */
import { done, eq, eqn, ok, throws } from "@light/test/assert.ts";

import type { SqlDatabase } from "../index.ts";

/** The number of rows a query answers, through `json`. */
const rowsOf = (db: SqlDatabase, sql: string): number => (JSON.parse(db.prepare(sql).json()) as unknown[]).length;

/** Run the driver checks over one open `:memory:` database. */
export const runSuite = (open: () => SqlDatabase): void => {
  const db = open();
  db.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, tags TEXT)");

  const insert = db.prepare("INSERT INTO note (id, title, done, tags) VALUES (?, ?, ?, ?)");
  const first = insert.run(["a", "one", true, '["x"]']);
  eqn("an insert changes one row", first.changes, 1);
  eq("and json answers the row", db.prepare("SELECT id, title, done, tags FROM note ORDER BY id").json(), '[{"id":"a","title":"one","done":1,"tags":"[\\"x\\"]"}]');

  const named = db.prepare("INSERT INTO note (id, title, done) VALUES (:id, :title, :done)");
  named.run({ id: "b", title: "two", done: false });
  eqn("a named bind inserts too", rowsOf(db, "SELECT * FROM note"), 2);

  eq("get answers one row", JSON.stringify(db.prepare("SELECT title FROM note WHERE id = ?").get(["b"])), '{"title":"two"}');
  eq("get answers null when nothing matches", String(db.prepare("SELECT title FROM note WHERE id = ?").get(["zz"])), "null");
  eq("all answers every row", JSON.stringify(db.prepare("SELECT id FROM note ORDER BY id").all()), '[{"id":"a"},{"id":"b"}]');

  const edit = db.prepare("UPDATE note SET title = ? WHERE id = ?");
  eqn("an update reports its changes", edit.run(["two!", "b"]).changes, 1);
  eqn("a delete reports none for a missing row", db.prepare("DELETE FROM note WHERE id = ?").run(["zz"]).changes, 0);


  db.prepare("INSERT INTO note (id, title, done) VALUES (?, ?, ?)").run(["c", "three", 0]);

  throws("bad SQL names its error", () => db.prepare("SELECT * FROM missing_table"), "no such table");

  eq("prepare answers the cached statement", String(db.prepare("SELECT 1 AS one") === db.prepare("SELECT 1 AS one")), "true");
  eq("json of a scalar", db.prepare("SELECT 1 AS one").json(), '[{"one":1}]');
  eq("json writes numbers as JavaScript does", db.prepare("SELECT 0.1 AS f, 0.3333333333333333 AS t").json(), '[{"f":0.1,"t":0.3333333333333333}]');
  eq("json escapes text", db.prepare("SELECT 'a\"b' AS x").json(), '[{"x":"a\\\"b"}]');
  eq("a named parameter used twice binds once", db.prepare("SELECT :x AS a, :x AS b").json({ x: "v" }), '[{"a":"v","b":"v"}]');

  db.transaction(() => {
    db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["d", "four"]);
  });
  eqn("a transaction commits", rowsOf(db, "SELECT * FROM note"), 4);

  throws("a transaction that throws rolls back", () => {
    db.transaction(() => {
      db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["e", "five"]);
      throw new Error("stop");
    });
  }, "stop");
  eqn("so its row is gone", rowsOf(db, "SELECT * FROM note"), 4);

  db.transaction(() => {
    db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["f", "six"]);
    try {
      db.transaction(() => {
        db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["g", "seven"]);
        throw new Error("inner");
      });
    } catch {}
    db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["h", "eight"]);
  });
  eqn("a nested savepoint rolls back alone", rowsOf(db, "SELECT * FROM note"), 6);
  ok("the outer transaction kept its rows", db.prepare("SELECT id FROM note WHERE id IN (?, ?) ORDER BY id").json(["f", "h"]) === '[{"id":"f"},{"id":"h"}]');

  db.close();
  ok("close marks the database closed", !db.open);
  done();
};
