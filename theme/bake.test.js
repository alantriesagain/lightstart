import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { STATE_FOCUS_WITHIN } from "../tdom/classes.ts";
import { bakeTables, classStringsOf, collectClasses, render } from "./bake.js";
import defaultTheme from "./themes/default.js";

const TASKS = ["flex-1", "flex-1 border focus-within:bg-surface", "flex-1 flex-row", "flex-1 overflow-y-auto", "focus:font-bold", "font-bold text-primary", "text-muted", "text-muted bg-surface", "text-muted line-through focus:font-bold"];

test("the class strings of a source: static attributes, ternaries and alternations of literals, in either quote", () => {
  const source = 'const a = html`<div class="flex-1 border"><p class=${done ? "text-muted line-through" : "focus:font-bold"}>x</p><b class=\'bold\'></b><i class=${x ? "italic" : ("plain" as string)}></i></div>`;\nconst b = html`<span class="plain">${x}</span>`;';
  const { classes, problems } = classStringsOf(source, "views/a.ts", ts);
  assert.deepEqual(problems, []);
  assert.deepEqual(classes, ["bold", "flex-1 border", "focus:font-bold", "italic", "plain", "text-muted line-through"]);
});

test("a class the baker cannot read as literals is a problem naming its site", () => {
  const source = 'const a = html`<div class=${classesOf(item)}></div>\n<p class="x ${more}"></p>\n<i class=${cond ? "a" : variable}></i>`;';
  const { classes, problems } = classStringsOf(source, "views/b.ts", ts);
  assert.deepEqual(classes, []);
  assert.deepEqual(problems, [
    "views/b.ts:1:29: class= takes a value that is not a string literal, a ternary or an alternation of them",
    "views/b.ts:2:15: class= mixes text with a binding; write the whole value as literals",
    "views/b.ts:3:12: class= takes a value that is not a string literal, a ternary or an alternation of them",
  ]);
});

test("collectClasses walks the tasks app's imports and answers exactly its nine strings", () => {
  const { classes, problems, files } = collectClasses("examples/tasks/main.js", ts);
  assert.deepEqual(problems, []);
  assert.deepEqual(classes, TASKS);
  assert.ok(files.includes("examples/tasks/views/task-row.ts") && files.includes("tdom/node.ts"));
});

test("bakeTables compiles each string per scheme through the terminal styler, states kept, and names an ignored class", () => {
  const { tables, problems } = bakeTables(["text-muted", "flex-1 border focus-within:bg-surface"], defaultTheme, ["dark", "light"]);
  assert.deepEqual(problems, []);
  assert.deepEqual(tables.get("dark"), [["text-muted", [["fg", "#7f857e", 0]]], ["flex-1 border focus-within:bg-surface", [["flex", 1, 0], ["border", true, 0], ["bg", "#171a17", STATE_FOCUS_WITHIN]]]]);
  assert.deepEqual(tables.get("light")?.[0], ["text-muted", [["fg", "#6b716b", 0]]]);
  assert.deepEqual(bakeTables(["text-sm rounded"], defaultTheme, ["dark"]).problems, ['dark: the terminal ignores "text-sm"', 'dark: the terminal ignores "rounded"']);
});

test("render is deterministic and writes one export per scheme", () => {
  const { tables } = bakeTables(["flex-1"], defaultTheme, ["dark"]);
  const text = render(tables, "app/main.js", "light classes:bake app/main.js -o app/classes.baked.js --scheme dark");
  assert.equal(text, render(tables, "app/main.js", "light classes:bake app/main.js -o app/classes.baked.js --scheme dark"));
  assert.match(text, /^\/\*\*\n \* @file The class strings the templates reached from app\/main\.js write/);
  assert.match(text, /\/\*\* @type \{BakedEntry\[\]\} \*\/\nexport const dark = \[\n  \["flex-1", \[\["flex", 1, 0\]\]\],\n\];\n$/);
});
