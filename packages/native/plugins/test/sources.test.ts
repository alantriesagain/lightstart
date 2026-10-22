// node-only
/**
 * @file A plugin folder's sources: its .js files by name, nothing else, and none when the folder is gone.
 * node-only: it walks the file system.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourcesIn } from "../sources.ts";
import { done, eq } from "@light/test/assert.ts";

const dir = mkdtempSync(join(tmpdir(), "plugins-sources-"));
writeFileSync(join(dir, "b.js"), "b");
writeFileSync(join(dir, "a.js"), "a");
writeFileSync(join(dir, "notes.txt"), "no");
mkdirSync(join(dir, "c.js"));
const files = sourcesIn(dir);
eq("only the .js files, by name, a directory named .js skipped", files.map((s) => s.file.slice(dir.length + 1)).join(",") + " " + files.map((s) => s.code).join(""), "a.js,b.js ab");
eq("a folder that is not there has no sources", String(sourcesIn(join(dir, "missing")).length), "0");
rmSync(dir, { recursive: true, force: true });
done();
