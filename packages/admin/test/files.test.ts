// node-only
/**
 * @file `files` over an in-memory backend, and `history` as one undo step per
 * snapshot: contents before and after, an outside change still undone to what
 * was recorded, and the change signal.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { clearHistory, configureFiles, DevFilesBackend, files, history } from "../index.ts";
import type { FileEntry, FilesBackend } from "../index.ts";

class MemoryBackend implements FilesBackend {
  readonly entries = new Map<string, string | Blob>();

  async read(path: string): Promise<string | null> {
    const value = this.entries.get(path);
    if (value === undefined) return null;
    return typeof value === "string" ? value : await value.text();
  }

  async readBlob(path: string): Promise<Blob | null> {
    const value = this.entries.get(path);
    if (value === undefined) return null;
    return typeof value === "string" ? new Blob([value]) : value;
  }

  async write(path: string, content: string | Blob): Promise<void> {
    this.entries.set(path, content);
  }

  async delete(path: string): Promise<void> {
    this.entries.delete(path);
  }

  async list(dir: string): Promise<FileEntry[]> {
    const prefix = `${dir}/`;
    const names = new Set<string>();
    for (const path of this.entries.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash < 0 ? rest : rest.slice(0, slash));
    }
    return [...names]
      .sort()
      .map((name) => {
        const path = `${dir}/${name}`;
        const value = this.entries.get(path);
        return { path, name, kind: value === undefined ? "dir" : "file", size: typeof value === "string" ? value.length : 0, modified: 0 };
      });
  }

  async exists(path: string): Promise<boolean> {
    return this.entries.has(path);
  }
}

const main = async (): Promise<void> => {
  const backend = new MemoryBackend();
  backend.entries.set("social/a.md", "one");
  backend.entries.set("social/b.md", "two");
  configureFiles(backend);
  clearHistory();

  eq("reading a stored file", (await files.read("social/a.md")) ?? "", "one");
  eq("a missing file reads null", String(await files.read("social/none.md")), "null");
  ok("exists finds a stored file", await files.exists("social/a.md"));
  ok("exists misses a missing file", !(await files.exists("social/none.md")));
  eq("a listing names both files", (await files.list("social")).map((entry) => entry.name).join(","), "a.md,b.md");

  const before = files.changed.value;
  await files.write("social/c.md", "three");
  eqn("a write bumps changed once", files.changed.value, before + 1);
  await files.delete("social/c.md");
  eqn("a delete bumps changed again", files.changed.value, before + 2);

  const badPath = await files.read("../secret").then(
    () => "",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );
  ok("a bad path is refused before the backend sees it", badPath.includes("not allowed"));

  backend.entries.set("social/a.md", "one");
  eq("history starts with no labels", history.labels().join(","), "");
  ok("and nothing to undo", !history.canUndo.value);

  await history.snapshot(["social/a.md"], "edit a", async () => {
    await files.write("social/a.md", "changed");
  });
  eq("the write is in place", (await files.read("social/a.md")) ?? "", "changed");
  eq("the step's label is listed", history.labels().join(","), "edit a");
  ok("there is a step to undo", history.canUndo.value);

  await history.undo();
  eq("undo restores the recorded content", (await files.read("social/a.md")) ?? "", "one");
  ok("undo moves the step to redo", history.canRedo.value && !history.canUndo.value);
  await history.redo();
  eq("redo restores what the step left", (await files.read("social/a.md")) ?? "", "changed");

  await history.snapshot(["social/a.md", "social/b.md"], "remove b", async () => {
    await files.write("social/a.md", "changed again");
    await files.delete("social/b.md");
  });
  eq("a second step is pushed", history.labels().join(","), "edit a,remove b");
  await history.undo();
  eq("undoing the second step writes both paths back", `${(await files.read("social/a.md")) ?? ""},${(await files.read("social/b.md")) ?? ""}`, "changed,two");

  backend.entries.set("social/a.md", "outside");
  await history.undo();
  eq("a step still restores what it recorded after an outside change", (await files.read("social/a.md")) ?? "", "one");

  configureFiles(new DevFilesBackend());
  clearHistory();
  done();
};

await main();
