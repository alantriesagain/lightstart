import { test } from "node:test";
import assert from "node:assert/strict";
import { stripComments, stripCssComments } from "./strip-comments.js";

test("stripComments blanks block and whole-line comments and keeps offsets", () => {
  const source = 'const a = 1; /* gone\nstill gone */ const b = "http://x.y";\n  // whole line\nconst c = 2; // trailing stays\n';
  const out = stripComments(source);
  assert.equal(out.length, source.length);
  assert.equal(out.indexOf("const b"), source.indexOf("const b"));
  assert.ok(!out.includes("gone"));
  assert.ok(out.includes('"http://x.y"'));
  assert.ok(!out.includes("whole line"));
  assert.ok(out.includes("// trailing stays"));
  assert.equal(out.split("\n").length, source.split("\n").length);
});

test("stripCssComments blanks only block comments", () => {
  const css = ".a { color: red; } /* note\nmore */ .b { }";
  const out = stripCssComments(css);
  assert.equal(out.length, css.length);
  assert.ok(!out.includes("note"));
  assert.equal(out.indexOf(".b"), css.indexOf(".b"));
});

test("stripComments stays linear on a long run of blank lines", () => {
  const source = `${" \n".repeat(200000)}  // tail\nconst x = 1;\n`;
  const started = performance.now();
  const out = stripComments(source);
  assert.ok(performance.now() - started < 1000);
  assert.equal(out.length, source.length);
  assert.ok(!out.includes("tail"));
  assert.ok(out.includes("const x = 1;"));
});
