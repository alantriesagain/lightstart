// ffi: native/ffi.json
// native-only
/**
 * @file The light model over the native SQLite driver: the schema makes the
 * table, the store runs its pipeline, and `has` reads a JSON array through
 * `json_each`. The same module is held to node by light's own model tests.
 */
import { defineModel } from "@lightstart/light/model";
import type { ModelSchema } from "@lightstart/light/model";
import { SqlWriter, openSql } from "@lightstart/light/model/sql";
import { Database } from "../native.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const note = defineModel("note", {
  title: { $type: "string", required: true, attribute: true, persist: true },
  tags: { $type: "array", defaultValue: [], attribute: false, persist: true },
  done: { $type: "boolean", defaultValue: false, attribute: true, persist: true },
} as ModelSchema);

const main = async (): Promise<void> => {
  const db = Database.open(":memory:");
  const store = await openSql({ name: "test", db, models: [note] });
  const one = await note.add({ title: "one", tags: ["a", "b"] });
  await note.add({ title: "two", tags: ["b"] });
  eq("the store reads its row back", String((await note.get(one.id))?.title), "one");
  eqn("getAll answers both rows", (await note.getAll({})).length, 2);
  eqn("has reads a JSON array", (await note.getAll({ where: { tags: { has: "a" } } })).length, 1);
  eqn("count follows the same where", await note.count({ where: { tags: { "has all": ["a", "b"] } } }), 1);
  const changes: string[] = [];
  const writer = new SqlWriter({ db, models: store.models, store, changes: (event: string) => { changes.push(event); } });
  const written = writer.add("note", { title: "three", tags: ["c"] });
  eq("the writer runs the pipeline at once", String(written["done"]), "false");
  eq("and the store reads its row", String((await note.get(String(written.id)))?.title), "three");
  eq("an edit merges over the stored row", JSON.stringify(writer.edit("note", String(written.id), { done: true })["tags"]), '["c"]');
  ok("a remove answers true", writer.remove("note", String(written.id)));
  eqn("and every write announced its change", changes.length, 3);
  await store.close();
  done();
};

main();
