/**
 * @file The task app's entry: rows in `<data>/tasks.jsonl` and
 * `<data>/boards.jsonl` (`--data <dir>`, the current directory by default)
 * through the JSONL adapter and a store in this process, the board
 * controller over them, and the app on the terminal. Ctrl+C quits.
 */

/** @import { KeyEvent } from "@bootstrapp/light/native" */

import { Renderer, TRoot, Terminal, mount } from "@bootstrapp/light/native";
import { configureModel, modelBus } from "@bootstrapp/light/model";
import { createStore, storeRequest } from "@bootstrapp/light/model/store";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import JsonlAdapter from "@bootstrapp/light/model/jsonl";
import boards from "./models/boards.js";
import tasks from "./models/tasks.js";
import board from "./controllers/board.js";
import { fileIO } from "./lib/file-io.ts";
import { TaskApp, appKey } from "./views/task-app.ts";

const at = process.argv.indexOf("--data");
const dir = at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : ".";

registerStorageAdapter("jsonl", JsonlAdapter);
const db = createAdapter("jsonl", { name: "tasks", dir, io: fileIO(dir) });
await db.init();
const store = createStore({ models: { boards: boards.schema, tasks: tasks.schema }, databases: { jsonl: db }, defaultAdapter: "jsonl", emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });
await board.$ready;

const term = new Terminal();
if (!term.isTTY) {
  console.error("tasks: needs an interactive terminal");
  process.exit(2);
}
const root = new TRoot();
const renderer = new Renderer(term, root);
const app = new TaskApp();
mount(app, root);
renderer.onKey = (/** @type {KeyEvent} */ e) => {
  if (e.ctrl && e.key === "char" && e.text === "c") {
    renderer.stop();
    process.exit(0);
  }
  return appKey(renderer, app, e);
};
renderer.start();
