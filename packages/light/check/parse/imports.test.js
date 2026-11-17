import assert from "node:assert/strict";
import test from "node:test";
import { parseImports, typeImports } from "./imports.js";

test("parseImports classifies statements, skips type imports and commented specifiers", () => {
  const src = `import "@lightstart/light/app/entry.js";
import T from "@lightstart/light/types";
import { html } from "@lightstart/light/html";
import * as ns from "./ns.js";
import type { X } from "@lightstart/x";
export { y } from "./y.js";
export type { Z } from "./z.ts";
/** import { Nope } from "@lightstart/nope" */
const mod = await import("./lazy.js");
`;
  assert.deepEqual(parseImports(src).map((i) => [i.spec, i.kind]), [
    ["@lightstart/light/app/entry.js", "side-effect"],
    ["@lightstart/light/types", "default"],
    ["@lightstart/light/html", "named"],
    ["./ns.js", "named"],
    ["./y.js", "reexport"],
    ["./lazy.js", "dynamic"],
  ]);
  assert.equal(parseImports(src)[1].offset, src.indexOf("import T"));
});

test("typeImports finds import type, @import and import().T forms", () => {
  const src = `import type { A } from "@lightstart/a";
/** @import { B } from "@lightstart/b/types.ts" */
/** @type {import("@lightstart/c").C} */
const x = 1;
`;
  assert.deepEqual(typeImports(src).map((i) => i.spec), ["@lightstart/a", "@lightstart/b/types.ts", "@lightstart/c"]);
});
