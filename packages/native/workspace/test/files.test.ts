/**
 * @file The frontend's file and git services on a temp repository, from a subfolder: git's file list
 * (ignored files left out, untracked ones in), status letters with a rename's source and paths
 * relative to the folder, HEAD content kept byte for byte (last newline, multi-byte text),
 * binary detection, capped reads, and paths that would leave the folder refused.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { directoriesOf, insidePath, listFiles, readFileCapped } from "../files.ts";
import { openRepo, parseStatus, readHead, readStatus } from "../git.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const root = mkdtempSync(join(tmpdir(), "code-files-"));
const g = (args: string[]): void => {
  const all = ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", "-c", "init.defaultBranch=main"];
  for (const a of args) all.push(a);
  const r = spawnSync("git", all, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("git " + args.join(" ") + " failed");
};
const write = (rel: string, text: string): void => {
  writeFileSync(join(root, rel), text);
};

mkdirSync(join(root, "app", "src", "deep"), { recursive: true });
mkdirSync(join(root, "app", "dist"), { recursive: true });
write(".gitignore", "dist/\n");
write("top.txt", "outside the folder\n");
write("app/readme.md", "héllo ✓\nline two\n");
write("app/src/main.ts", "export const a = 1;\n");
write("app/src/old.ts", "old\n");
write("app/src/gone.ts", "gone\n");
write("app/noeol.txt", "no newline at the end");
writeFileSync(join(root, "app", "logo.bin"), Buffer.from([1, 2, 0, 3]));
g(["init", "-q"]);
g(["add", "."]);
g(["commit", "-qm", "init"]);
write("app/src/main.ts", "export const a = 2;\n");
write("app/src/deep/new.ts", "new\n");
write("app/dist/out.js", "built\n");
g(["mv", "app/src/old.ts", "app/src/renamed.ts"]);
rmSync(join(root, "app", "src", "gone.ts"));

const folder = join(root, "app");

const main = async (): Promise<void> => {
  const repo = await openRepo(folder);
  ok("the folder is in a work tree", repo.isRepo);
  eq("its prefix below the root", repo.prefix, "app/");
  ok("the git directory is absolute", repo.gitDir.endsWith("/.git") && repo.gitDir.startsWith("/"));

  const list = await listFiles(folder, true);
  eq("git's files: tracked and untracked, ignored left out, relative to the folder", list.paths.join(","), "logo.bin,noeol.txt,readme.md,src/deep/new.ts,src/gone.ts,src/main.ts,src/renamed.ts");
  eq("their directories", directoriesOf(list.paths).join(","), ",src,src/deep");

  const status = await readStatus(repo, folder);
  eq("branch", status.branch, "main");
  const byPath = new Map<string, string>();
  for (const e of status.entries) byPath.set(e.path, e.x + e.y + (e.orig.length > 0 ? "<" + e.orig : ""));
  eq("modified", byPath.get("src/main.ts") ?? "", " M");
  eq("deleted", byPath.get("src/gone.ts") ?? "", " D");
  eq("renamed, with its source", byPath.get("src/renamed.ts") ?? "", "R <src/old.ts");
  eq("untracked, as a file", byPath.get("src/deep/new.ts") ?? "", "??");
  eqn("nothing outside the folder or ignored", status.entries.length, 4);
  eq("status fields: a copy's source is consumed too", parseStatus("C  b\0a\0?? c\0", "").map((e) => e.path + ":" + e.orig).join(","), "b:a,c:");

  const head = await readHead(repo, folder, "readme.md", 1024 * 1024);
  ok("HEAD content exists", head.exists);
  eq("HEAD content is untrimmed and decoded once", head.text, "héllo ✓\nline two\n");
  eq("no last newline stays so", (await readHead(repo, folder, "noeol.txt", 1024)).text, "no newline at the end");
  ok("a file new since HEAD has none", !(await readHead(repo, folder, "src/deep/new.ts", 1024)).exists);
  ok("a binary file at HEAD is flagged", (await readHead(repo, folder, "logo.bin", 1024)).binary);
  const cut = await readHead(repo, folder, "readme.md", 4);
  ok("HEAD output past the cap is cut", cut.truncated && cut.text.length < 5);

  const file = readFileCapped(folder, "src/main.ts", 1024);
  ok("a read", file.exists && file.text === "export const a = 2;\n" && file.size === 20 && !file.truncated);
  const capped = readFileCapped(folder, "readme.md", 6);
  ok("a capped read", capped.truncated && capped.size === Buffer.byteLength("héllo ✓\nline two\n") && capped.text === "héllo");
  ok("a binary read", readFileCapped(folder, "logo.bin", 1024).binary);
  ok("a missing file", !readFileCapped(folder, "nope.txt", 1024).exists);
  ok("a directory is not a file", !readFileCapped(folder, "src", 1024).exists);
  eq("a path out of the folder is refused", insidePath(folder, "../top.txt") + insidePath(folder, "/etc/passwd") + insidePath(folder, "src/../../top.txt"), "");
  ok("a path inside is kept", insidePath(folder, "src/../readme.md") === join(folder, "readme.md"));
  ok("an escaping read finds nothing", !readFileCapped(folder, "../top.txt", 1024).exists);

  const plain = mkdtempSync(join(tmpdir(), "code-plain-"));
  mkdirSync(join(plain, "node_modules", "x"), { recursive: true });
  mkdirSync(join(plain, "lib"), { recursive: true });
  writeFileSync(join(plain, "node_modules", "x", "i.js"), "");
  writeFileSync(join(plain, "lib", "b.js"), "");
  writeFileSync(join(plain, "a.js"), "");
  symlinkSync("a.js", join(plain, "alias.js"), "file");
  symlinkSync(".", join(plain, "loop"), "dir");
  const notRepo = await openRepo(plain);
  ok("a plain folder is not a repo", !notRepo.isRepo);
  eq("a plain folder's walk skips dependencies and does not follow a symlink", (await listFiles(plain, false)).paths.join(","), "a.js,alias.js,lib/b.js,loop");
  eqn("its status is empty", (await readStatus(notRepo, plain)).entries.length, 0);
  rmSync(plain, { recursive: true, force: true });

  rmSync(root, { recursive: true, force: true });
  done();
};

main();
