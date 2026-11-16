// node-only
/**
 * @file More than one store: a model whose schema names the `user` database
 * writes there in memory and on disk, beside the default database.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { openApp } from "../test/index.ts";
import { prepare } from "../tui/index.ts";
import type { AppManifest } from "../manifest.ts";
import app from "./fixtures/tui/src/app.ts";
import note from "./fixtures/tui/src/models/note.ts";
import profile from "./fixtures/tui/src/models/profile.ts";

const manifest: AppManifest = {
  app,
  models: [{ name: "note", model: note }, { name: "profile", model: profile }],
  controllers: [],
  routes: null,
  views: [],
};

const main = async (): Promise<void> => {
  const memory = await openApp(manifest, { storage: "memory" });
  try {
    await note.add({ text: "memo" });
    await profile.add({ name: "Ada" });
    eq("the default database has the note", String((await note.getAll()).length), "1");
    eq("the named database has the profile", String((await profile.getAll()).length), "1");
    ok("the two databases are different adapters", memory.store.databases["memory"] !== memory.store.databases["user"]);
  } finally {
    await memory.stop();
  }

  const dir = mkdtempSync(join(tmpdir(), "light-app-databases-"));
  try {
    const prepared = await prepare(manifest, { data: dir, argv: [] });
    try {
      await note.add({ text: "on disk" });
      await profile.add({ name: "Grace" });
    } finally {
      await prepared.stop();
    }
    ok("the default folder has the note file", existsSync(join(dir, "note.jsonl")));
    ok("with the note", readFileSync(join(dir, "note.jsonl"), "utf8").includes("on disk"));
    ok("the user folder has the profile file", existsSync(join(dir, "user", "profile.jsonl")));
    ok("with the profile", readFileSync(join(dir, "user", "profile.jsonl"), "utf8").includes("Grace"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  done();
};

await main();
