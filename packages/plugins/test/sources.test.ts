// node-only
/**
 * @file A plugin folder's sources: its .js files and its subfolders' index.js by name, nothing else, and none when the folder is gone;
 * a folder plugin's own files, its subfolders' included, and its folders, and a change to any of its files telling.
 * node-only: it walks the file system.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { foldersOf, isFolderPlugin, moduleFilesOf, printOf, sourcesIn } from "../sources.ts";
import { done, eq } from "@lightstart/test/assert.ts";

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
mkdirSync(join(dir, "bb", "lib"));
writeFileSync(join(dir, "bb", "lib", "x.js"), "X");
const index = join(dir, "bb", "index.js");
eq("a folder's index.js is a folder plugin, a file of its own is not", String(isFolderPlugin(index)) + " " + String(isFolderPlugin(join(dir, "a.js"))), "true false");
eq("a folder plugin's files, its subfolders' too, by path", moduleFilesOf(index).map((s) => s.file.slice(dir.length + 1)).join(","), "bb/index.js,bb/lib/x.js");
eq("and its folders", foldersOf(index).map((f) => f.slice(dir.length + 1)).join(","), "bb,bb/lib");
const before = printOf(moduleFilesOf(index));
writeFileSync(join(dir, "bb", "lib", "x.js"), "Y");
eq("a change to one of its files tells", String(printOf(moduleFilesOf(index)) === before), "false");
rmSync(dir, { recursive: true, force: true });
done();
