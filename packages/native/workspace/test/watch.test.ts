/**
 * @file The frontend's tree watcher on a temp repository: two writes in one tick reach the listener
 * as one batch within a second; a file in an ignored directory is not reported; a directory
 * made with its contents is reported whole and then watched; `git add` is reported as a git
 * change; a removed directory is released; nothing arrives after close.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { directoriesOf, listFiles } from "../files.ts";
import { openRepo } from "../git.ts";
import { ChangeBatch, TreeWatch } from "../watch.ts";
import { budget, done, eq, ok } from "@light/test/assert.ts";

const root = mkdtempSync(join(tmpdir(), "code-watch-"));
const write = (rel: string, text: string): void => {
  writeFileSync(join(root, rel), text);
};
const git = (args: string[]): void => {
  const all = ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t"];
  for (const a of args) all.push(a);
  spawnSync("git", all, { encoding: "utf8" });
};
mkdirSync(join(root, "a", "b"), { recursive: true });
mkdirSync(join(root, "c"), { recursive: true });
mkdirSync(join(root, "dist"), { recursive: true });
write(".gitignore", "dist/\n");
write("a/x.ts", "1");
write("a/b/y.ts", "1");
write("c/z.ts", "1");
write("dist/out.js", "1");
git(["init", "-q"]);
git(["add", "."]);
git(["commit", "-qm", "init"]);

const received: ChangeBatch[] = [];
let waiter: ((b: ChangeBatch | null) => void) | null = null;

const next = (timeoutMs: number): Promise<ChangeBatch | null> =>
  new Promise((resolve) => {
    if (received.length > 0) {
      resolve(received.shift() ?? null);
      return;
    }
    let settled = false;
    waiter = (b: ChangeBatch | null) => {
      if (settled) return;
      settled = true;
      waiter = null;
      resolve(b);
    };
    setTimeout(() => {
      if (settled) return;
      settled = true;
      waiter = null;
      resolve(null);
    }, timeoutMs);
  });

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });

const describe = (b: ChangeBatch | null): string => (b === null ? "none" : b.paths.join(",") + (b.structure ? " +structure" : "") + (b.git ? " +git" : ""));

const main = async (): Promise<void> => {
  const repo = await openRepo(root);
  const list = await listFiles(root, true);
  const w = new TreeWatch(root, 150);
  w.onBatch = (b: ChangeBatch) => {
    const fn = waiter;
    if (fn !== null) fn(b);
    else received.push(b);
  };
  w.start(directoriesOf(list.paths), repo.gitDir);
  eq("watched: the listed directories (not the ignored one) and the git directory", String(w.watchedCount), "5");

  const t0 = Date.now();
  write("a/x.ts", "2");
  write("c/new.ts", "1");
  const first = await next(2000);
  const ms = Date.now() - t0;
  eq("two writes, one batch", describe(first), "a/x.ts,c/new.ts +structure");
  ok("within a second", ms < budget(1000));
  ok("the events were counted", first !== null && first.events >= 2);
  eq("then nothing more", describe(await next(400)), "none");

  write("dist/out.js", "2");
  eq("a write under an ignored directory is not reported", describe(await next(400)), "none");

  mkdirSync(join(root, "n", "deep"), { recursive: true });
  write("n/deep/f.txt", "1");
  eq("a directory made with its contents, reported whole", describe(await next(2000)), "n,n/deep,n/deep/f.txt +structure");
  await wait(50);
  write("n/deep/f.txt", "2");
  eq("and then watched", describe(await next(2000)), "n/deep/f.txt");

  write("a/b/y.ts", "2");
  await next(2000);
  git(["add", "a/b/y.ts"]);
  const staged = await next(2000);
  ok("git add is a git change", staged !== null && staged.git);

  const before = w.watchedCount;
  rmSync(join(root, "c"), { recursive: true, force: true });
  eq("a removed directory", describe(await next(2000)), "c +structure");
  eq("its watch released", String(before - w.watchedCount), "1");

  w.close();
  write("a/x.ts", "3");
  eq("nothing after close", describe(await next(400)), "none");
  rmSync(root, { recursive: true, force: true });
  done();
};

main();
