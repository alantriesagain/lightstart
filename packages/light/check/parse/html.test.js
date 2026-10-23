import assert from "node:assert/strict";
import test from "node:test";
import { moduleScripts } from "./html.js";

test("moduleScripts keeps the page's offsets and newlines, and only the module scripts' text", () => {
  const html = `<!doctype html>
<script type="importmap">{ "imports": {} }</script>
<script type="module">
import View from "@bootstrapp/light";
View.define("fx-a", {});
</script>
<p class="x">hi</p>
<script type='module'>const b = 2;</script>
<script type="module" src="./app.js"></script>
`;
  const out = moduleScripts(html);
  assert.equal(out.length, html.length);
  assert.equal(out.split("\n").length, html.split("\n").length);
  assert.equal(out.indexOf("View.define"), html.indexOf("View.define"));
  assert.equal(out.indexOf("const b = 2;"), html.indexOf("const b = 2;"));
  assert.ok(!out.includes("importmap") && !out.includes("<p") && !out.includes("app.js"));
  assert.deepEqual(out.split("\n").filter((line) => line.trim()).map((line) => line.trim()), ['import View from "@bootstrapp/light";', 'View.define("fx-a", {});', "const b = 2;"]);
});

test("a page without a module script blanks to spaces", () => {
  const html = "<p>a</p>\n<script>var x = 1;</script>\n";
  assert.equal(moduleScripts(html), html.replace(/[^\n]/g, " "));
});
