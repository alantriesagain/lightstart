/**
 * @file The app on light's test terminal: `openApp` opens the generated manifest's store
 * over memory, the root view runs, a typed todo reaches the model, and a toggle is drawn.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { frames, runApp } from "@lightstart/light/native/tui";
import { TestTerminal } from "@lightstart/light/native/tui/test-terminal.ts";
import { openApp } from "@lightstart/app/test";
import manifest from "../.light/app.ts";
import todo from "../src/models/todo.ts";
import AppRoot from "../src/views/app-root.ts";

const main = async (): Promise<void> => {
  const app = await openApp(manifest);
  const root = new (manifest.rootView as new () => AppRoot)();
  const term = new TestTerminal();
  term.cols = 60;
  term.rows = 12;
  const renderer = runApp({ app: root, term, onKey: (r, e) => root.onKey(r, e) });

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
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
  const keys = async (text: string): Promise<void> => {
    renderer.decoder.pushText(text);
    await settle();
  };

  try {
    await settle();
    ok("the empty app says so", screen().includes("No todos yet"));

    await keys("write the adapter\r");
    await keys("drive the app\r");
    ok("both todos are listed", screen().includes("[ ] write the adapter") && screen().includes("[ ] drive the app"));
    ok("the count follows", screen().includes("2 todos"));

    const rows = await todo.getAll({ order: "addedAt" });
    eq("the model reads both rows", String(rows.length), "2");

    await keys("\t");
    await keys(" ");
    ok("Space on the focused todo toggles it", screen().includes("[x] write the adapter"));
  } finally {
    renderer.stop();
    await app.stop();
  }
};

await main();
done();
