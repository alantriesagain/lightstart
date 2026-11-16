// node-only
/**
 * @file The terminal app on a test terminal: `openApp` opens the fixture's
 * store over memory, the root view is made and run with `runApp`, a key it
 * takes adds a note through the controller, and a write read back through
 * the model is drawn.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { frames, runApp } from "@lightstart/light/native/tui";
import { TerminalClasses } from "@lightstart/light/theme/terminal";
import theme from "@lightstart/light/theme/themes/default.js";
import { TestTerminal } from "@lightstart/light/native/tui/test-terminal.ts";
import { openApp } from "../test/index.ts";
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
  const term = new TestTerminal();
  term.cols = 50;
  term.rows = 10;
  const root = new AppRoot();
  const renderer = runApp({ app: root, term, classes: new TerminalClasses(theme, "dark"), onKey: (r, e) => root.onKey(r, e) });

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await new Promise((settle) => setTimeout(settle, 0));
    frames.flush();
    renderer.renderFrame();
  };
  const screen = (): string => {
    const { w, h, glyph } = renderer.back;
    const lines: string[] = [];
    for (let y = 0; y < h; y++) {
      let line = "";
      for (let x = 0; x < w; x++) line += glyph[y * w + x] === 0 ? " " : String.fromCodePoint(glyph[y * w + x] ?? 0);
      lines.push(line.trimEnd());
    }
    return lines.join("\n");
  };

  try {
    await settle();
    ok("the empty app says so", screen().includes("No notes yet."));

    renderer.decoder.pushText("a");
    await settle();
    ok("the root view's key adds a note", screen().includes("note 1"));

    await notes.add("second");
    await settle();
    ok("a write through the controller is drawn", screen().includes("second"));

    const rows = await note.getAll({ order: "text" });
    eq("the model reads both rows", String(rows.length), "2");
  } finally {
    renderer.stop();
    await app.stop();
  }
  done();
};

await main();
