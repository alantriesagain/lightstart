/**
 * @file The app on light's test terminal: `openApp` opens the generated manifest's store
 * over memory, `mountApp` runs the root view, a typed todo reaches the model, and a toggle is drawn.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { openApp } from "@lightstart/app/test";
import { mountApp } from "@lightstart/app/tui/test";
import manifest from "../.light/app.ts";
import todo from "../src/models/todo.ts";

const main = async (): Promise<void> => {
  const app = await openApp(manifest);
  const mounted = mountApp(manifest, app, { cols: 60, rows: 12 });
  const keys = async (text: string): Promise<void> => {
    mounted.renderer.decoder.pushText(text);
    await mounted.settle();
  };

  try {
    await mounted.settle();
    ok("the empty app says so", mounted.text().includes("No todos yet"));

    await keys("write the adapter\r");
    await keys("drive the app\r");
    ok("both todos are listed", mounted.text().includes("[ ] write the adapter") && mounted.text().includes("[ ] drive the app"));
    ok("the count follows", mounted.text().includes("2 todos"));

    const rows = await todo.getAll({ order: "addedAt" });
    eq("the model reads both rows", String(rows.length), "2");

    await keys("\t");
    await keys(" ");
    ok("Space on the focused todo toggles it", mounted.text().includes("[x] write the adapter"));
  } finally {
    mounted.stop();
    await app.stop();
  }
};

await main();
done();
