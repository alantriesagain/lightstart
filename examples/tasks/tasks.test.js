/**
 * @file The task app driven on a test terminal: keys go in through the
 * renderer's decoder, the rows land in JSONL files held in memory, and the
 * checks read the painted screen. The files start with a task from before
 * boards, which the first board adopts. The theme's classes style the screen
 * on the dark scheme from the baked table, three of them are read off the
 * painted cells, the focus states among them, and every class the screens
 * used must be in the table. A second store over the same files reads the
 * tasks and the boards back. Runs with `node examples/tasks/tasks.test.js`.
 */
import { ATTR_BOLD, ATTR_STRIKE, TInput, TRUECOLOR_FLAG, frames, runApp } from "@bootstrapp/light/native/tui";
import { BakedClasses } from "@bootstrapp/light/theme/baked";
import { openJsonl } from "@bootstrapp/light/model/jsonl";
import { done, eq, eqn, ok } from "../../native/assert.js";
import { TestTerminal } from "../../native/tui/test-terminal.ts";
import boards from "./models/boards.js";
import tasks from "./models/tasks.js";
import board from "./controllers/board.js";
import { TaskApp, appKey } from "./views/task-app.ts";
import { dark } from "./classes.baked.js";

/** @type {Map<string, string>} */
const files = new Map();
files.set("data/tasks.jsonl", '{"id":"old1","title":"old task","addedAt":1,"done":false}\n');
const io = {
  /** @param {string} path */
  read: (path) => files.get(path) ?? null,
  /** @param {string} path @param {string} text */
  append: (path, text) => {
    files.set(path, (files.get(path) ?? "") + text);
  },
  /** @param {string} path @param {string} text */
  write: (path, text) => {
    files.set(path, text);
  },
};

const open = () => openJsonl({ name: "tasks", dir: "data", io, models: [boards, tasks] });

await open();
await board.$ready;

const term = new TestTerminal();
term.cols = 72;
term.rows = 14;
const styler = new BakedClasses(dark);
const app = new TaskApp();
const renderer = runApp({ app, term, classes: styler, onKey: (r, e) => appKey(r, app, e) });

const settle = async () => {
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await board.$queries.rows.ensure();
    await board.$queries.boards.ensure();
  }
  frames.flush();
  renderer.renderFrame();
};

const screen = () => {
  const { w, h, glyph } = renderer.back;
  const lines = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += glyph[y * w + x] === 0 ? " " : String.fromCodePoint(glyph[y * w + x]);
    lines.push(line.trimEnd());
  }
  return lines.join("\n");
};

/** @param {string} text */
const keys = async (text) => {
  renderer.decoder.pushText(text);
  await settle();
};

/** @param {string} path */
const lineCount = (path) => (files.get(path) ?? "").split("\n").filter(Boolean).length;

/** @param {string} text the painted cell where a text starts, -1 when it is not on screen */
const cellOf = (text) => {
  const lines = screen().split("\n");
  for (let y = 0; y < lines.length; y++) {
    const x = lines[y].indexOf(text);
    if (x >= 0) return y * renderer.back.w + x;
  }
  return -1;
};

/** @param {number} cell @returns {string} the foreground, the bold and strike bits and the background of a painted cell */
const paintOf = (cell) => `fg=${renderer.back.fg[cell] === (TRUECOLOR_FLAG | 0xe9ebe8) ? "primary" : renderer.back.fg[cell] === (TRUECOLOR_FLAG | 0x7f857e) ? "muted" : String(renderer.back.fg[cell])} bold=${(renderer.back.attrs[cell] & ATTR_BOLD) !== 0} strike=${(renderer.back.attrs[cell] & ATTR_STRIKE) !== 0} bg=${renderer.back.bg[cell] === (TRUECOLOR_FLAG | 0x171a17) ? "surface" : String(renderer.back.bg[cell])}`;

/** @param {string} text the half of the screen a text is on: the left or the right column */
const side = (text) => {
  for (const line of screen().split("\n")) {
    const at = line.indexOf(text);
    if (at >= 0) return at < 36 ? "left" : "right";
  }
  return "none";
};

await settle();
ok("a task from before boards is in the first board", screen().includes("[ ] old task") && screen().includes("Tasks"));
eqn("its adoption is one edit in the file", lineCount("data/tasks.jsonl"), 2);
eqn("the first board is one line in its file", lineCount("data/boards.jsonl"), 1);
ok("the footer names the filter", screen().includes("tasks: all"));
ok("the editor has the focus from the start", renderer.focus instanceof TInput);
eq("the active board's title is bold in the primary token, the board untinted while the editor has the focus", paintOf(cellOf("Tasks")), "fg=primary bold=true strike=false bg=-1");
eq("an open task is painted plain", paintOf(cellOf("[ ] old task")), "fg=-1 bold=false strike=false bg=-1");

await keys("write the adapter\r");
await keys("drive the app\r");
ok("both tasks are listed", screen().includes("[ ] write the adapter") && screen().includes("[ ] drive the app"));
ok("the footer counts them", screen().includes("3 open, 0 done"));
eqn("each add is one line in the file", lineCount("data/tasks.jsonl"), 4);

await keys("\t");
eq("the focused task is bold, on the surface tint of the board holding the focus", paintOf(cellOf("[ ] old task")), "fg=-1 bold=true strike=false bg=surface");
eq("the title shares the tint", paintOf(cellOf("Tasks")), "fg=primary bold=true strike=false bg=surface");
await keys(" ");
ok("Space on the focused task toggles it", screen().includes("[x] old task"));
ok("the counts follow", screen().includes("2 open, 1 done"));
eq("a done task is muted and struck through, bold while it keeps the focus", paintOf(cellOf("[x] old task")), "fg=muted bold=true strike=true bg=surface");

await keys("f");
ok("f filters to the open tasks", screen().includes("tasks: open") && !screen().includes("old task") && screen().includes("drive the app"));
ok("the focused task left the screen, so nothing has the focus and the board loses its tint", renderer.focus === null && paintOf(cellOf("Tasks")).endsWith("bg=-1"));
await keys("f");
ok("then to the done ones", screen().includes("tasks: done") && screen().includes("[x] old task") && !screen().includes("drive the app"));
eq("a done task out of focus is muted and struck through, plain", paintOf(cellOf("[x] old task")), "fg=muted bold=false strike=true bg=-1");
await keys("f");

await keys("\t");
await keys("d");
ok("d deletes the focused task", !screen().includes("old task") && screen().includes("drive the app"));
ok("and the counts follow", screen().includes("2 open, 0 done"));

await keys("\x1b[27u");
ok("Esc brings the focus back to the editor", renderer.focus instanceof TInput);
await keys("/board Later\r");
ok("/board adds a board beside the first, empty and focused", side("Later") === "right" && screen().includes("No tasks yet"));
await keys("/delete\r");
ok("/delete removes the focused board while it is empty", !screen().includes("Later"));
await keys("/board Later\r");
await keys("ship it\r");
ok("a task typed lands in the focused board", side("[ ] ship it") === "right" && screen().includes("3 open"));

await keys("\t");
const before = lineCount("data/tasks.jsonl");
await keys("\x1b[1;2C");
ok("Shift+Right moves the focused task to the next board", side("write the adapter") === "right" && side("drive the app") === "left");
eqn("as one edit in the file", lineCount("data/tasks.jsonl"), before + 1);

await keys("\t");
await keys("]");
ok("] moves the focused board right", side("Tasks") === "right" && side("Later") === "left");
await keys("\x1b[27u");
await keys("/delete\r");
ok("/delete refuses a board with tasks", screen().includes("Tasks") && screen().includes("Later"));
await keys("/rename Done\r");
ok("/rename renames the focused board", side("Done") === "right" && !screen().includes("Tasks"));

let ignored = "";
for (const cls of styler.ignored) ignored += cls + " ";
eq("every class the screens used is in the baked table", ignored, "");

renderer.stop();
await open();
eq("a store over the same files reads the tasks back", (await tasks.getAll({ order: "addedAt" })).map((task) => String(task.title)).join(","), "write the adapter,drive the app,ship it");
eq("and the boards in their order", (await boards.getAll({ order: "position" })).map((b) => String(b.title)).join(","), "Later,Done");
done();
