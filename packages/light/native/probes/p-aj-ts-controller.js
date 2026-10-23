/**
 * @file Probe AJ: a controller as a TypeScript class (`controller/class.ts`) over a model, the
 * form a TypeScript app such as widecode holds its state in: a subclass with a signal field, a
 * live query built again when the signal changes, `start()` and `$ready`, methods that write
 * through the model it imports, the rows read through `LiveRows` after each write, `dispose()`
 * and a write after it.
 */

import { openStore } from "./p-aj-ts-controller.model.js";
import { Board } from "./p-aj-ts-controller.board.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await openStore();
const board = new Board();
await board.start();
console.log("started", board.hooks.join(","), "pending", board.rows.pending, "total", board.rows.total);
await board.add("write the probe");
await board.add("run it");
await settle();
console.log("all", board.titles(), "total", board.rows.total);
await board.toggle(board.rows.value[0]);
board.filter.value = "open";
await settle();
console.log("open", board.titles());
board.filter.value = "done";
await settle();
console.log("done", board.titles());
await board.dispose();
console.log("disposed", board.hooks.join(","));
await board.add("after dispose");
await settle();
console.log("still", board.titles());
