// node-only
/**
 * @file More than one store: a model whose schema names the `user` store
 * writes there in memory and on disk, beside `main`; a store of an adapter type the
 * host cannot run, and a model naming a store the app does not declare, are
 * errors before anything opens.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { openApp } from "../test/index.ts";
import { JsonlAdapterType, TuiHost } from "../tui/index.ts";
import { defineApp } from "../index.ts";
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
  const memory = await openApp(manifest);
  try {
    await note.add({ text: "memo" });
    await profile.add({ name: "Ada" });
    eq("the default database has the note", String((await note.getAll()).length), "1");
    eq("the named database has the profile", String((await profile.getAll()).length), "1");
    ok("the two databases are different adapters", memory.store.databases["main"] !== memory.store.databases["user"]);
  } finally {
    await memory.stop();
  }

  const dir = mkdtempSync(join(tmpdir(), "light-app-databases-"));
  try {
    const host = new TuiHost({ argv: ["--data", dir] });
    app.args.values = host.args(app);
    const store = await host.openStores(manifest, false);
    try {
      await note.add({ text: "on disk" });
      await profile.add({ name: "Grace" });
    } finally {
      await store.close();
    }
    ok("the default folder has the note file", existsSync(join(dir, "note.jsonl")));
    ok("with the note", readFileSync(join(dir, "note.jsonl"), "utf8").includes("on disk"));
    ok("the user folder has the profile file", existsSync(join(dir, "user", "profile.jsonl")));
    ok("with the profile", readFileSync(join(dir, "user", "profile.jsonl"), "utf8").includes("Grace"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const browserOnly = defineApp({ name: "browser-only", host: "tui", stores: { cache: { adapter: "indexeddb" } } });
  let refused = "";
  try {
    await new TuiHost({ argv: [] }).openStores({ app: browserOnly, models: [], controllers: [], routes: null, views: [] }, false);
  } catch (error) {
    refused = error instanceof Error ? error.message : String(error);
  }
  ok("an adapter type the host cannot run is an error naming the host and its adapter types", refused.includes('The tui host cannot run the "indexeddb" store "cache"') && refused.includes("jsonl, memory"));

  const onDiskDir = mkdtempSync(join(tmpdir(), "light-app-adapters-"));
  try {
    const onDisk = defineApp({ name: "on-disk", host: "tui", stores: { main: { at: onDiskDir } } });
    const opened = await openApp({ app: onDisk, models: [{ name: "note", model: note }], controllers: [], routes: null, views: [] }, { adapters: [new JsonlAdapterType()] });
    await note.add({ text: "written" });
    await opened.stop();
    ok("a test opens the stores with the adapter types it names: the row is on disk", readFileSync(join(onDiskDir, "note.jsonl"), "utf8").includes("written"));
  } finally {
    rmSync(onDiskDir, { recursive: true, force: true });
  }

  const undeclared = defineApp({ name: "undeclared", host: "tui" });
  let missing = "";
  try {
    await openApp({ app: undeclared, models: [{ name: "profile", model: profile }], controllers: [], routes: null, views: [] });
  } catch (error) {
    missing = error instanceof Error ? error.message : String(error);
  }
  ok("a model naming a store the app does not declare is an error", missing.includes('keeps its rows in the store "user"'));

  const chosen = defineApp({ name: "chosen", host: "tui", args: { keep: { flag: true, description: "Keep the rows" } }, stores: { main: { adapter: (args) => (args.flag("keep") ? "jsonl" : "memory") } } });
  const kept = mkdtempSync(join(tmpdir(), "light-app-adapter-"));
  try {
    const keepHost = new TuiHost({ argv: ["--keep", "--data", kept] });
    chosen.args.values = keepHost.args(chosen);
    const onDisk = await keepHost.openStores({ app: chosen, models: [{ name: "note", model: note }], controllers: [], routes: null, views: [] }, false);
    await note.add({ text: "kept" });
    await onDisk.close();
    ok("an adapter read from the arguments: jsonl when they ask to keep", existsSync(join(kept, "note.jsonl")));
    const untouched = join(kept, "untouched");
    const quietHost = new TuiHost({ argv: ["--keep", "--data", untouched] });
    chosen.args.values = quietHost.args(chosen);
    const quiet = await quietHost.openStores({ app: chosen, models: [{ name: "note", model: note }], controllers: [], routes: null, views: [] }, false);
    await note.getAll();
    await quiet.close();
    ok("a store nothing was written to leaves no folder", !existsSync(untouched));
    const memoryHost = new TuiHost({ argv: ["--data", kept] });
    chosen.args.values = memoryHost.args(chosen);
    const inMemory = await memoryHost.openStores({ app: chosen, models: [{ name: "note", model: note }], controllers: [], routes: null, views: [] }, false);
    ok("and memory when they do not", inMemory.databases["main"] !== undefined && (await note.getAll()).length === 0);
    await inMemory.close();
  } finally {
    rmSync(kept, { recursive: true, force: true });
  }
  done();
};

await main();
