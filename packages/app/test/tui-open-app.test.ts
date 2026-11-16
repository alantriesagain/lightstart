// node-only
/**
 * @file The terminal app on a test terminal: `openApp` opens the fixture's
 * store over memory, `mountApp` runs the root view on a `TestTerminal`, a key
 * it takes adds a note (the view told it is mounted first) through the controller, and a write read back through
 * the model is drawn.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { TerminalClasses } from "@lightstart/light/theme/terminal";
import theme from "@lightstart/light/theme/themes/default.js";
import { openApp, mountApp } from "../test/index.ts";
import type { AppManifest } from "../manifest.ts";
import note from "./fixtures/tui/src/models/note.ts";
import notes from "./fixtures/tui/src/controllers/notes.ts";
import AppRoot from "./fixtures/tui/src/views/app-root.ts";

const manifest: AppManifest = {
  app: { name: "fixture-tui-test", host: "tui", storage: { kind: "memory" } },
  rootView: AppRoot,
  models: [{ name: "note", model: note }],
  controllers: [{ name: "notes", controller: notes }],
  routes: null,
  views: ["app-root", "note-row"],
};

const main = async (): Promise<void> => {
  const app = await openApp(manifest, { storage: "memory" });
  const mounted = mountApp(manifest, app, { cols: 50, rows: 10, classes: new TerminalClasses(theme, "dark") });

  try {
    await mounted.settle();
    ok("the root view was told it is mounted, with the renderer", mounted.root instanceof AppRoot && mounted.root.mountedCols === 50);
    ok("the empty app says so", mounted.text().includes("No notes yet."));

    mounted.renderer.decoder.pushText("a");
    await mounted.settle();
    ok("the root view's key adds a note", mounted.text().includes("note 1"));

    await notes.add("second");
    await mounted.settle();
    ok("a write through the controller is drawn", mounted.text().includes("second"));

    const rows = await note.getAll({ order: "text" });
    eq("the model reads both rows", String(rows.length), "2");
  } finally {
    mounted.stop();
    await app.stop();
  }
  done();
};

await main();
