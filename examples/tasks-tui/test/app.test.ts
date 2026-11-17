/**
 * @file The app on light's test terminal: `openApp` opens the generated manifest over memory
 * stores with `--list Work`, `mountApp` runs the root view. The list `--list` names is made and
 * open; typed tasks reach the model; F2 shows every list with its count, F3 this run's activity,
 * which lives in its own store; F1 comes back to the tasks, and Space toggles one.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { openApp } from "@lightstart/app/test";
import { mountApp } from "@lightstart/app/tui/test";
import manifest from "../.light/app.ts";
import task from "../src/models/task.ts";
import event from "../src/models/event.ts";

const main = async (): Promise<void> => {
  const app = await openApp(manifest, { args: ["--list", "Work"] });
  const mounted = mountApp(manifest, app, { cols: 60, rows: 14 });
  const keys = async (text: string): Promise<void> => {
    mounted.renderer.decoder.pushText(text);
    await mounted.settle();
  };

  try {
    await mounted.settle();
    ok("the list --list names is made and open", mounted.text().includes("Tasks · Work"));
    ok("an empty list says so", mounted.text().includes("No tasks here yet"));

    await keys("write the adapter\r");
    await keys("drive the app\r");
    ok("both tasks are listed", mounted.text().includes("[ ] write the adapter") && mounted.text().includes("[ ] drive the app"));
    eq("the model has both rows", String((await task.getAll()).length), "2");

    await keys("\x1bOQ");
    ok("F2 shows the lists with their counts", mounted.text().includes("Work 0/2 done"));

    await keys("\x1bOR");
    ok("F3 shows this run's activity, newest first", mounted.text().includes("added drive the app") && mounted.text().includes("made the list Work"));
    eq("in the activity store", String((await event.getAll()).length), "3");

    await keys("\x1bOP");
    await keys("\t");
    await keys(" ");
    ok("back on the tasks, Space toggles the focused one", mounted.text().includes("[x] write the adapter"));
  } finally {
    mounted.stop();
    await app.stop();
  }
};

await main();
done();
