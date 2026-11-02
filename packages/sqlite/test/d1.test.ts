// node-only
/**
 * @file The D1-shaped binding over node's driver: prepare and bind, first,
 * raw, all and run with D1's result shapes and metadata, exec's count, a batch
 * that applies all of its statements or none, and the strict mode that refuses
 * what Cloudflare D1 refuses.
 */
import { done, eq, eqn, ok, throws } from "@light/test/assert.ts";
import { D1_MAX_BOUND_PARAMETERS, D1_MAX_SQL_BYTES, d1Of } from "../d1.ts";
import { Database } from "../node.ts";

const main = async (): Promise<void> => {
  const d1 = d1Of(Database.open(":memory:"));
  await d1.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT NOT NULL)");
  const insert = d1.prepare("INSERT INTO note (id, title) VALUES (?, ?)");
  const ran = await insert.bind("a", "one").run();
  eqn("run answers D1's changes", ran.meta.changes, 1);
  ok("run says the database changed", ran.meta.changed_db);
  ok("run's last_row_id is a number", typeof ran.meta.last_row_id === "number");
  ok("run measures a duration", typeof ran.meta.duration === "number" && ran.meta.duration >= 0);
  ok("run leaves rows_read out", !("rows_read" in ran.meta));
  ok("run leaves rows_written out", !("rows_written" in ran.meta));

  eq("first answers a row", String((await d1.prepare("SELECT title FROM note WHERE id = ?").bind("a").first())?.["title"]), "one");
  eq("and null when none", String(await d1.prepare("SELECT title FROM note WHERE id = ?").bind("zz").first()), "null");
  eq("first(column) answers that column's value", String(await d1.prepare("SELECT title FROM note WHERE id = ?").bind("a").first("title")), "one");
  eq("first(column) answers null when there is no row", String(await d1.prepare("SELECT title FROM note WHERE id = ?").bind("zz").first("title")), "null");
  throws("first(column) refuses a column that is not there", () => d1.prepare("SELECT title FROM note WHERE id = ?").bind("a").first("missing") as unknown as void, "D1_COLUMN_NOTFOUND: Column not found (missing)");

  const raw = await d1.prepare("SELECT id, title FROM note ORDER BY id").raw();
  eqn("raw answers one array per row", raw.length, 1);
  eq("raw's row is values", JSON.stringify(raw[0]), '["a","one"]');
  const named = await d1.prepare("SELECT id, title FROM note ORDER BY id").raw({ columnNames: true });
  eq("raw puts the column names first", JSON.stringify(named[0]), '["id","title"]');
  eq("and then the values", JSON.stringify(named[1]), '["a","one"]');

  const all = await d1.prepare("SELECT * FROM note").all();
  eqn("all answers results", all.results.length, 1);
  ok("all succeeds", all.success);
  eqn("all's changes", all.meta.changes, 0);
  eqn("all's last_row_id", all.meta.last_row_id, 0);
  ok("all is not a change", !all.meta.changed_db);
  ok("all measures a duration", typeof all.meta.duration === "number" && all.meta.duration >= 0);
  ok("all leaves rows_read out", !("rows_read" in all.meta));
  ok("all leaves rows_written out", !("rows_written" in all.meta));

  const executed = await d1.exec("INSERT INTO note (id, title) VALUES ('d', 'four'); INSERT INTO note (id, title) VALUES ('e', 'five')");
  eqn("exec counts the statements", executed.count, 2);
  ok("exec measures a duration", typeof executed.duration === "number" && executed.duration >= 0);
  eqn("exec ran both statements", (await d1.prepare("SELECT * FROM note").all()).results.length, 3);

  let refused = false;
  try {
    await d1.batch([insert.bind("b", "two"), insert.bind("a", "duplicate")]);
  } catch {
    refused = true;
  }
  ok("a batch with a failing statement is refused", refused);
  eqn("and none of it is applied", (await d1.prepare("SELECT * FROM note").all()).results.length, 3);
  eqn("a batch that succeeds applies every statement", (await d1.batch([insert.bind("b", "two"), insert.bind("c", "three")])).length, 2);
  eqn("and each batch result has D1's meta", (await d1.batch([insert.bind("f", "six")]))[0]!.meta.changes, 1);

  const strict = d1Of(Database.open(":memory:"), { strict: true });
  await strict.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT NOT NULL)");
  throws("strict refuses BEGIN in prepare", () => strict.prepare("BEGIN"), "D1_ERROR: cannot start a transaction within a transaction");
  const transactionStatements: [string, string][] = [["COMMIT", "COMMIT"], ["ROLLBACK", "ROLLBACK"], ["SAVEPOINT s", "SAVEPOINT"], ["RELEASE s", "RELEASE"], ["  -- a comment\n END", "END"]];
  for (const [sql, name] of transactionStatements) {
    throws(`strict refuses ${name}`, () => strict.prepare(sql), "D1_ERROR: cannot start a transaction within a transaction");
  }
  throws("strict refuses BEGIN in exec", () => strict.exec("BEGIN") as unknown as void, "D1_ERROR: cannot start a transaction within a transaction");
  throws("strict refuses a statement past D1's length", () => strict.prepare("SELECT '" + "a".repeat(D1_MAX_SQL_BYTES) + "'"), "D1_ERROR: statement too long");
  throws("strict refuses a statement past D1's length in exec", () => strict.exec("SELECT '" + "a".repeat(D1_MAX_SQL_BYTES) + "'") as unknown as void, "D1_ERROR: statement too long");
  const tooMany = Array.from({ length: D1_MAX_BOUND_PARAMETERS + 1 }, () => 1);
  throws("strict refuses more bound parameters than D1 allows", () => strict.prepare("SELECT ?").bind(...tooMany), "D1_ERROR: too many SQL variables");
  eqn("strict still runs an ordinary statement", (await strict.batch([strict.prepare("INSERT INTO note (id, title) VALUES (?, ?)").bind("a", "one")]))[0]!.meta.changes, 1);
  eq("strict still reads it", String(await strict.prepare("SELECT title FROM note").first("title")), "one");
  await strict.exec("CREATE TABLE log (title TEXT)");
  const created = await strict.exec(
    "CREATE TRIGGER note_logged AFTER INSERT ON note BEGIN INSERT INTO log (title) VALUES (CASE WHEN new.title = '' THEN 'blank' ELSE new.title END); INSERT INTO log (title) VALUES ('second'); END; SELECT 1",
  );
  eqn("a trigger's body stays one statement, with the one after it", created.count, 2);
  await strict.prepare("INSERT INTO note (id, title) VALUES (?, ?)").bind("b", "two").run();
  eq("and the trigger runs", JSON.stringify((await strict.prepare("SELECT title FROM log ORDER BY rowid").all()).results.map((row) => row.title)), '["two","second"]');

  const loose = d1Of(Database.open(":memory:"));
  await loose.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT NOT NULL)");
  await loose.prepare("BEGIN").run();
  await loose.prepare("INSERT INTO note (id, title) VALUES (?, ?)").bind("a", "one").run();
  await loose.prepare("COMMIT").run();
  eq("a non-strict binding allows an explicit transaction", String(await loose.prepare("SELECT title FROM note").first("title")), "one");
  await loose.exec("BEGIN; INSERT INTO note (id, title) VALUES ('b', 'two'); COMMIT");
  eqn("and exec runs one too", (await loose.prepare("SELECT * FROM note").all()).results.length, 2);
  const looseLong = "SELECT '" + "a".repeat(D1_MAX_SQL_BYTES) + "' AS value";
  eqn("a non-strict binding allows SQL past D1's length", (await loose.prepare(looseLong).all()).results.length, 1);

  done();
};

main();
