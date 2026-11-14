import assert from "node:assert/strict";
import test from "node:test";
import { configureHighlight, highlightLines } from "./highlight.js";

test("without an override a known language is coloured by @lightstart/highlight", () => {
  const lines = highlightLines("const a = 1;", "javascript");
  const types = lines.flat().map((run) => run.type);
  assert.ok(types.includes("keyword"), "a keyword is coloured");
  assert.ok(types.includes("number"), "a number is coloured");
  assert.equal(lines.flat().map((run) => run.text).join(""), "const a = 1;");
});

test("an unknown language, or none, is plain lines, blank lines included", () => {
  const code = "<div>\n\n  <span>x</span>\n</div>";
  const plain = code.split("\n").map((text) => [{ text, type: null }]);
  assert.deepEqual(highlightLines(code, "not-a-language"), plain);
  assert.deepEqual(highlightLines(code), plain);
});

test("a configured tokenizer wins, and can be taken away again", () => {
  configureHighlight({ lines: (code, language) => [[{ text: code, type: language ?? "plain" }]] });
  assert.deepEqual(highlightLines("const a = 1;", "js"), [[{ text: "const a = 1;", type: "js" }]]);
  configureHighlight({ lines: null });
  const types = highlightLines("const a = 1;", "js").flat().map((run) => run.type);
  assert.ok(types.includes("keyword"), "the built-in tokenizer colours again");
  assert.ok(!types.includes("js"), "the override no longer answers");
});
