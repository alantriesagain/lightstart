// node-only
/**
 * @file A plugin folder's sources: its .js files and its subfolders' index.js by name, nothing else, and none when the folder is gone.
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
mkdirSync(join(dir, "bb"));
writeFileSync(join(dir, "bb", "index.js"), "B");
writeFileSync(join(dir, "bb", "README.md"), "no");
mkdirSync(join(dir, "empty"));
writeFileSync(join(dir, "empty", "other.js"), "no");
const files = sourcesIn(dir);
eq("the .js files and a folder's index.js, by name; a folder without index.js skipped", files.map((s) => s.file.slice(dir.length + 1)).join(",") + " " + files.map((s) => s.code).join(""), "a.js,b.js,bb/index.js abB");
eq("a folder that is not there has no sources", String(sourcesIn(join(dir, "missing")).length), "0");
rmSync(dir, { recursive: true, force: true });
done();
