/**
 * @file The entry: rows in `<data>/todos.jsonl` (`--data <dir>`, `.data` by default) through the
 * JSONL adapter and a store in this process, the theme's classes on the terminal from the baked
 * table (`classes.baked.ts`; `--scheme light|dark`, dark by default), and the app. Ctrl+C quits.
 */
import { runApp, Terminal } from "@lightstart/light/native/tui";
import { BakedClasses } from "@lightstart/light/theme/baked";
import { openTodos } from "./controllers/todos.ts";
import { dark, light } from "./classes.baked.ts";
import { fileIO } from "./lib/file-io.ts";
import { TodoApp, appKey } from "./views/todo-app.ts";

import type { BakedEntry } from "@lightstart/light/theme/baked";

const argument = (name: string, fallback: string): string => {
  const at = process.argv.indexOf(name);
  return at >= 0 && at + 1 < process.argv.length ? (process.argv[at + 1] ?? fallback) : fallback;
};

const dir = argument("--data", ".data");
const scheme = argument("--scheme", "dark");
if (scheme !== "dark" && scheme !== "light") {
  console.error("--scheme takes dark or light");
  process.exit(2);
}

await openTodos(dir, fileIO(dir));

const term = new Terminal();
if (!term.isTTY) {
  console.error("needs an interactive terminal");
  process.exit(2);
}
const app = new TodoApp();
const table = (scheme === "light" ? light : dark) as unknown as BakedEntry[];
runApp({ app, term, classes: new BakedClasses(table), onKey: (renderer, e) => appKey(renderer, app, e) });
