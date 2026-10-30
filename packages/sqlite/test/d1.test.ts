// node-only
/**
 * @file The D1-shaped binding over node's driver: prepare and bind, first,
 * all and run with D1's result shapes, and a batch that applies all of its
 * statements or none.
 */
import { done, eq, eqn, ok } from "@light/test/assert.ts";
import { d1Of } from "../d1.ts";
import { Database } from "../node.ts";

const main = async (): Promise<void> => {
  const d1 = d1Of(Database.open(":memory:"));
  await d1.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT NOT NULL)");
  const insert = d1.prepare("INSERT INTO note (id, title) VALUES (?, ?)");
  const ran = await insert.bind("a", "one").run();
  eqn("run answers D1's changes", ran.meta.changes, 1);
  eq("first answers a row", String((await d1.prepare("SELECT title FROM note WHERE id = ?").bind("a").first())?.["title"]), "one");
  eq("and null when none", String(await d1.prepare("SELECT title FROM note WHERE id = ?").bind("zz").first()), "null");
  eqn("all answers results", (await d1.prepare("SELECT * FROM note").all()).results.length, 1);
  let refused = false;
  try {
    await d1.batch([insert.bind("b", "two"), insert.bind("a", "duplicate")]);
  } catch {
    refused = true;
  }
  ok("a batch with a failing statement is refused", refused);
  eqn("and none of it is applied", (await d1.prepare("SELECT * FROM note").all()).results.length, 1);
  eqn("a batch that succeeds applies every statement", (await d1.batch([insert.bind("b", "two"), insert.bind("c", "three")])).length, 2);
  done();
};

main();
