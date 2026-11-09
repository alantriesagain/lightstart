import assert from "node:assert/strict";
import test from "node:test";
import { configureHighlight, highlightLines } from "./highlight.js";

test("without a tokenizer every line is one plain run, blank lines included", () => {
  const code = "<div>\n\n  <span>x</span>\n</div>";
  assert.deepEqual(highlightLines(code), code.split("\n").map((text) => [{ text, type: null }]));
});

test("a configured tokenizer answers the runs, and can be taken away again", () => {
  configureHighlight({ lines: (code, language) => [[{ text: code, type: language ?? "plain" }]] });
  assert.deepEqual(highlightLines("x = 1", "js"), [[{ text: "x = 1", type: "js" }]]);
  configureHighlight({ lines: null });
  assert.deepEqual(highlightLines("x = 1", "js"), [[{ text: "x = 1", type: null }]]);
});
