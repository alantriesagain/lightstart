import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bake } from "@lightstart/light/theme/bake.js";
import { BakedClasses } from "@lightstart/light/theme/baked";
import { frames, runApp, TInput } from "@lightstart/light/native/tui";
import { TestTerminal } from "@lightstart/light/native/tui/test-terminal.ts";
import { openTodos, todos } from "../src/controllers/todos.ts";
import { dark } from "../src/classes.baked.ts";
import { todos as todoModel } from "../src/models/todos.ts";
import { TodoApp, appKey } from "../src/views/todo-app.ts";

import type { JsonlIO } from "@lightstart/light/model";

const files = new Map<string, string>();
const io: JsonlIO = {
  read: (path: string) => files.get(path) ?? null,
  append: (path: string, text: string) => {
    files.set(path, (files.get(path) ?? "") + text);
  },
  write: (path: string, text: string) => {
    files.set(path, text);
  },
};

describe("__NAME__", () => {
  it("adds, toggles, filters and deletes todos on the terminal", async () => {
    await openTodos("data", io);

    const term = new TestTerminal();
    term.cols = 60;
    term.rows = 12;
    const styler = new BakedClasses(dark);
    const app = new TodoApp();
    const renderer = runApp({ app, term, classes: styler, onKey: (r, e) => appKey(r, app, e) });

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
    const lineCount = (path: string): number => (files.get(path) ?? "").split("\n").filter(Boolean).length;

    await settle();
    assert.ok(screen().includes("No todos yet"), "the empty app says so");
    assert.ok(screen().includes("filter: all"), "the footer names the filter");
    assert.ok(renderer.focus instanceof TInput, "the editor has the focus from the start");

    await keys("write the adapter\r");
    await keys("drive the app\r");
    assert.ok(screen().includes("[ ] write the adapter") && screen().includes("[ ] drive the app"), "both todos are listed");
    assert.ok(screen().includes("2 open, 0 done"), "the footer counts them");
    assert.equal(lineCount("data/todos.jsonl"), 2, "each add is one JSONL line");

    await keys("\t");
    await keys(" ");
    assert.ok(screen().includes("[x] write the adapter"), "Space on the focused todo toggles it");
    assert.ok(screen().includes("1 open, 1 done"), "the counts follow");

    await keys("f");
    assert.ok(screen().includes("filter: open") && !screen().includes("[x] write the adapter"), "f filters to the open todos");
    await keys("f");
    assert.ok(screen().includes("filter: done") && screen().includes("[x] write the adapter"), "then to the done ones");
    await keys("f");

    await keys("\t");
    await keys("d");
    assert.ok(!screen().includes("[x] write the adapter"), "d removes the focused todo");
    assert.ok(screen().includes("1 open, 0 done"), "the counts follow the removal");

    await keys("\x1b[27u");
    assert.ok(renderer.focus instanceof TInput, "Esc brings the focus back to the editor");
    await keys("clear the done ones\r");
    await keys("\t");
    await keys(" ");
    await keys("c");
    assert.ok(!screen().includes("[x] clear the done ones"), "c clears the done todos");
    assert.ok(screen().includes("1 open, 0 done"), "only the open todo is left");

    assert.equal([...styler.ignored].join(" "), "", "every class the screens used is in the baked table");
    renderer.stop();

    await todos.dispose();
    await openTodos("data", io);
    const all = await todoModel.getAll({ order: "addedAt" });
    assert.equal(all.map((row) => String(row.title)).join(","), "clear the done ones", "a store over the same file reads the todo back");

    const current = await bake(["src/main.ts", "-o", "src/classes.baked.ts", "--scheme", "dark,light", "--check"]);
    assert.equal(current, true, "the baked class table is current");
    await todos.dispose();
  });
});
