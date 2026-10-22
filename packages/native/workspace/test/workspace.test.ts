/**
 * @file The frontend's workspace on a temp repository: its files and status, and a file write reaching
 * the changes listener as one batch within a second.
 * Runs under node and natively; the outputs must be identical.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChangeBatch } from "../watch.ts";
import { openWorkspace } from "../workspace.ts";
import { budget, done, eq, ok } from "@light/test/assert.ts";

const base = mkdtempSync(join(tmpdir(), "code-ws-"));
const folder = join(base, "repo");
mkdirSync(join(folder, "src"), { recursive: true });
const git = (args: string[]): void => {
  const all = ["-C", folder, "-c", "user.email=t@t", "-c", "user.name=t", "-c", "init.defaultBranch=main"];
  for (const a of args) all.push(a);
  spawnSync("git", all, { encoding: "utf8" });
};
writeFileSync(join(folder, "src", "a.ts"), "one\n");
git(["init", "-q"]);
git(["add", "."]);
git(["commit", "-qm", "init"]);
writeFileSync(join(folder, "src", "a.ts"), "two\n");
writeFileSync(join(folder, "b.md"), "new\n");


const main = async (): Promise<void> => {
  const ws = await openWorkspace(folder, 150);
  ok("a repository", ws.repo.isRepo);
  eq("files", (await ws.files()).paths.join(","), "b.md,src/a.ts");
  const status = await ws.status();
  eq("status", status.branch + ":" + status.entries.map((e) => e.x + e.y + e.path).join(","), "main: Msrc/a.ts,??b.md");

  const t0 = Date.now();
  const changed = await new Promise<string>((resolve) => {
    ws.onChanges = (b: ChangeBatch) => resolve(b.paths.join(",") + (b.structure ? " +structure" : ""));
    writeFileSync(join(folder, "src", "a.ts"), "three\n");
    setTimeout(() => resolve("none"), 2000);
  });
  eq("a write reaches the listener as one batch", changed, "src/a.ts");
  ok("within a second", Date.now() - t0 < budget(1000));
  ws.close();
  rmSync(base, { recursive: true, force: true });
  done();
};

main();
