/**
 * @file The task app's entry: rows in `<data>/tasks.jsonl` and
 * `<data>/boards.jsonl` (`--data <dir>`, the current directory by default)
 * through the JSONL adapter and a store in this process, the board
 * controller over them, the theme's classes on the terminal from the baked
 * table (`classes.baked.js`; `--scheme light|dark`, dark by default), and
 * the app. Ctrl+C quits.
 */
import { Terminal, runApp } from "@bootstrapp/light/native/tui";
import { BakedClasses } from "@bootstrapp/light/theme/baked";
import { openJsonl } from "@bootstrapp/light/model/jsonl";
import boards from "./models/boards.js";
import tasks from "./models/tasks.js";
import board from "./controllers/board.js";
import { fileIO } from "./lib/file-io.ts";
import { TaskApp, appKey } from "./views/task-app.ts";
import { dark, light } from "./classes.baked.js";

const at = process.argv.indexOf("--data");
const dir = at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : ".";
const schemeAt = process.argv.indexOf("--scheme");
const scheme = schemeAt >= 0 && schemeAt + 1 < process.argv.length ? process.argv[schemeAt + 1] : "dark";
if (scheme !== "dark" && scheme !== "light") {
  console.error("tasks: --scheme takes dark or light");
  process.exit(2);
}

await openJsonl({ name: "tasks", dir, io: fileIO(dir), models: [boards, tasks] });
await board.$ready;

const term = new Terminal();
if (!term.isTTY) {
  console.error("tasks: needs an interactive terminal");
  process.exit(2);
}
const app = new TaskApp();
runApp({ app, term, classes: new BakedClasses(scheme === "light" ? light : dark), onKey: (renderer, e) => appKey(renderer, app, e) });
