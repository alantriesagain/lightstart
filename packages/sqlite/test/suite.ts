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
export const runSuite = (open: (options?: { cacheStatements?: number }) => SqlDatabase): void => {
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
  eqn("a select reports no changes", db.prepare("SELECT 1 AS one").run().changes, 0);
  eqn("a delete reports none for a missing row", db.prepare("DELETE FROM note WHERE id = ?").run(["zz"]).changes, 0);


  db.prepare("INSERT INTO note (id, title, done) VALUES (?, ?, ?)").run(["c", "three", 0]);

  db.exec("CREATE TABLE big (id TEXT PRIMARY KEY, body TEXT)");
  const big = "x".repeat(10000);
  const returned = db.prepare("INSERT INTO big (id, body) VALUES (?, ?) RETURNING id, body");
  eqn("a result over the first buffer keeps its row", (JSON.parse(returned.json(["big", big])) as Array<{ body: string }>)[0].body.length, 10000);
  eqn("and the write ran once", Number(db.prepare("SELECT COUNT(*) AS n FROM big").get()?.n ?? 0), 1);

  db.exec("CREATE TABLE nums (id TEXT PRIMARY KEY, text TEXT)");
  db.prepare("INSERT INTO nums (id, text) VALUES (?, ?)").run(["n", 1]);
  eq("a safe integer binds as an integer", String(db.prepare("SELECT text FROM nums WHERE id = 'n'").get()?.text), "1");
  eqn("and division stays integer", Number(db.prepare("SELECT 7 / 2 AS v").get()?.v ?? 0), 3);

  db.exec("CREATE TABLE enc (id TEXT PRIMARY KEY, blob BLOB, big INTEGER)");
  db.prepare("INSERT INTO enc (id, blob, big) VALUES (?, ?, ?)").run(["e", new Uint8Array([1, 2, 3]), 9007199254740993n]);
  const encoded = (JSON.parse(db.prepare("SELECT blob, big FROM enc WHERE id = 'e'").json()) as Array<Record<string, unknown>>)[0]!;
  eq("a blob is base64", String(encoded["blob"]), "AQID");
  eq("an unsafe integer is text", String(encoded["big"]), "9007199254740993");
  eq("small floats look like JavaScript", db.prepare("SELECT 0.00001 AS small, 1e20 AS wide, -0.0 AS zero").json(), '[{"small":0.00001,"wide":100000000000000000000,"zero":0}]');
  eq("non-finite floats are null", db.prepare("SELECT 1e999 AS v").json(), '[{"v":null}]');
  eq("a duplicate column keeps its last value", db.prepare("SELECT 1 AS a, 2 AS a").json(), '[{"a":2}]');
  eq("control characters escape", db.prepare("SELECT char(1) AS c").json(), '[{"c":"\\u0001"}]');

  eqn("a transaction answers its body", db.transaction(() => 7), 7);
  throws("a thenable transaction body is refused", () => { db.transaction(() => Promise.resolve()); }, "synchronous");

  throws("bad SQL names its error", () => db.prepare("SELECT * FROM missing_table"), "no such table");

  eq("prepare answers the cached statement", String(db.prepare("SELECT 1 AS one") === db.prepare("SELECT 1 AS one")), "true");
  const evicting = open({ cacheStatements: 1 });
  const kept = evicting.prepare("SELECT 1 AS v");
  evicting.prepare("SELECT 2 AS v");
  eqn("an evicted statement is still usable", Number(kept.get()?.v ?? 0), 1);
  evicting.close();
  eq("json of a scalar", db.prepare("SELECT 1 AS one").json(), '[{"one":1}]');
  eq("json writes numbers as JavaScript does", db.prepare("SELECT 0.1 AS f, 0.3333333333333333 AS t").json(), '[{"f":0.1,"t":0.3333333333333333}]');
  eq("json escapes text", db.prepare("SELECT 'a\"b' AS x").json(), '[{"x":"a\\\"b"}]');
  eq("a named parameter used twice binds once", db.prepare("SELECT :x AS a, :x AS b").json({ x: "v" }), '[{"a":"v","b":"v"}]');

  db.transaction(() => {
    db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["d", "four"]);
    return 0;
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
    return 0;
  });
  eqn("a nested savepoint rolls back alone", rowsOf(db, "SELECT * FROM note"), 6);
  ok("the outer transaction kept its rows", db.prepare("SELECT id FROM note WHERE id IN (?, ?) ORDER BY id").json(["f", "h"]) === '[{"id":"f"},{"id":"h"}]');

  db.exec("CREATE TABLE parent (id TEXT PRIMARY KEY)");
  db.exec("CREATE TABLE child (id TEXT PRIMARY KEY, parent TEXT NOT NULL REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)");
  throws("a failed commit keeps the depth", () => {
    db.transaction(() => {
      db.prepare("INSERT INTO child (id, parent) VALUES (?, ?)").run(["c1", "missing"]);
      return 0;
    });
  }, "FOREIGN KEY");
  db.transaction(() => {
    db.prepare("INSERT INTO parent (id) VALUES (?)").run(["p1"]);
    db.prepare("INSERT INTO child (id, parent) VALUES (?, ?)").run(["c2", "p1"]);
    return 0;
  });
  eqn("and the next transaction runs at depth zero", Number(db.prepare("SELECT COUNT(*) AS n FROM child").get()?.n ?? 0), 1);

  db.close();
  ok("close marks the database closed", !db.open);
  done();
};
