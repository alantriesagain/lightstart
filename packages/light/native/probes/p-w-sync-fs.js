/**
 * @file Probe W: the synchronous fs surface a desktop host lives on. Directories made and removed
 * recursively, entries listed and their kinds read through stat (a Dirent's `isDirectory()` is not
 * callable natively), stat fields, rename, append, unlink, a Buffer read hashed, and what a
 * failing stat throws (only `name` and `message` are readable on a catch binding; the message
 * starts with the code). Prints the same lines under node and natively.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(tmpdir(), "light-probe-w");
rmSync(root, { recursive: true, force: true });
mkdirSync(join(root, "a", "b"), { recursive: true });
mkdirSync(join(root, "a", "b"), { recursive: true });
writeFileSync(join(root, "a", "one.txt"), "one");
appendFileSync(join(root, "a", "one.txt"), "+two");
writeFileSync(join(root, "a", "b", "deep.bin"), Buffer.from([1, 2, 3, 250]));
console.log("read", readFileSync(join(root, "a", "one.txt"), "utf8"));
const names = readdirSync(join(root, "a")).map((name) => name + (statSync(join(root, "a", name)).isDirectory() ? "/" : "")).sort();
console.log("entries", names.join(","));
const st = statSync(join(root, "a", "one.txt"));
console.log("stat", st.size, st.isFile(), st.isDirectory(), st.mtimeMs > 0, st.ctimeMs > 0);
console.log("dir stat", statSync(join(root, "a", "b")).isDirectory());
renameSync(join(root, "a", "one.txt"), join(root, "a", "uno.txt"));
console.log("renamed", existsSync(join(root, "a", "one.txt")), existsSync(join(root, "a", "uno.txt")));
const bytes = readFileSync(join(root, "a", "b", "deep.bin"));
console.log("bytes", bytes.length, bytes[3], createHash("sha256").update(bytes).digest("hex").slice(0, 12));
unlinkSync(join(root, "a", "b", "deep.bin"));
rmdirSync(join(root, "a", "b"));
console.log("emptied", existsSync(join(root, "a", "b")));
try {
  statSync(join(root, "nope"));
  console.log("stat missing: no throw");
} catch (e) {
  console.log("stat missing throws", e instanceof Error, e instanceof Error ? e.message.startsWith("ENOENT") : false);
}
try {
  readFileSync(join(root, "nope.txt"), "utf8");
} catch (e) {
  console.log("read missing throws", e instanceof Error);
}
rmSync(root, { recursive: true, force: true });
rmSync(root, { recursive: true, force: true });
console.log("removed", existsSync(root));
