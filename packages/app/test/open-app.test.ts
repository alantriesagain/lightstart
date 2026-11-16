// node-only
/**
 * @file `openApp` over a memory store: the controller writes a note through
 * the model, and both the model and the controller's live rows read it back.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { openApp } from "../test/index.ts";
import type { AppManifest } from "../manifest.ts";
import note from "./fixtures/web/src/models/note.ts";
import notes from "./fixtures/web/src/controllers/notes.ts";
import { defineApp } from "../index.ts";

const manifest: AppManifest = {
  app: defineApp({ name: "fixture-open-app", host: "web", storage: { kind: "memory" } }),
  models: [{ name: "note", model: note }],
  controllers: [{ name: "notes", controller: notes }],
  routes: null,
  views: [],
};

const main = async (): Promise<void> => {
  const app = await openApp(manifest, { storage: "memory" });
  try {
    await notes.add("first");
    await notes.add("second");
    const rows = await note.getAll({ order: "text" });
    eq("the model reads both rows", String(rows.length), "2");
    eq("in order", String(rows[0]?.text), "first");

    await notes.rows.refresh();
    eq("the controller's live query sees them", String(notes.rows.value.length), "2");
    eq("with the first note", String(notes.rows.value[0]?.text), "first");
    ok("the handle exposes the store", app.store !== null);
  } finally {
    await app.stop();
  }
  done();
};

await main();
