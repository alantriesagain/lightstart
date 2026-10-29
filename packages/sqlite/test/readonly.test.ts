// node-only
/**
 * @file A read-only connection sees the writer's committed rows and refuses a
 * write, which is what a reader thread opens while one writer owns the file.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, throws } from "@light/test/assert.ts";
import { Database } from "../node.ts";

const dir = mkdtempSync(join(tmpdir(), "sqlite-readonly-"));
const path = join(dir, "app.db");
const writer = Database.open(path);
writer.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT)");
writer.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["a", "one"]);
writer.close();

const reader = Database.open(path, { readOnly: true });
eq("a read-only connection sees the committed row", reader.prepare("SELECT * FROM note").json(), '[{"id":"a","title":"one"}]');
throws("a write on a read-only connection is refused", () => reader.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["b", "two"]), "readonly");
reader.close();
rmSync(dir, { recursive: true, force: true });
done();
