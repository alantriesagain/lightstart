import assert from "node:assert/strict";
import test from "node:test";
import { htmlTemplates, scanTemplateEnd } from "./templates.js";

test("htmlTemplates returns outermost extents, stepping over nested templates and expressions", () => {
  const src = "const a = html`<div>${items.map((i) => html`<span>${i}</span>`)}</div>`; const b = other.html`x`; const c = html`<p>";
  const out = htmlTemplates(src);
  assert.equal(out.length, 1);
  assert.equal(out[0].content, "<div>${items.map((i) => html`<span>${i}</span>`)}</div>");
  assert.equal(out[0].start, src.indexOf("<div>"));
  assert.equal(scanTemplateEnd("abc", 0), -1);
});

test("an svg template is an extent too", () => {
  const src = "const icon = svg`<circle r=\"1\"></circle>`; const page = html`<p>${icon}</p>`;";
  assert.deepEqual(htmlTemplates(src).map((t) => t.content), ['<circle r="1"></circle>', "<p>${icon}</p>"]);
});
