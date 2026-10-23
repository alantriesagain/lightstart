import assert from "node:assert/strict";
import test from "node:test";
import { parseImports, typeImports } from "./imports.js";

test("parseImports classifies statements, skips type imports and commented specifiers", () => {
  const src = `import "bootstrapp/app/entry.js";
import T from "bootstrapp/types";
import { html } from "@bootstrapp/light/html";
import * as ns from "./ns.js";
import type { X } from "@bootstrapp/x";
export { y } from "./y.js";
export type { Z } from "./z.ts";
/** import { Nope } from "@bootstrapp/nope" */
const mod = await import("./lazy.js");
`;
  assert.deepEqual(parseImports(src).map((i) => [i.spec, i.kind]), [
    ["bootstrapp/app/entry.js", "side-effect"],
    ["bootstrapp/types", "default"],
    ["@bootstrapp/light/html", "named"],
    ["./ns.js", "named"],
    ["./y.js", "reexport"],
    ["./lazy.js", "dynamic"],
  ]);
  assert.equal(parseImports(src)[1].offset, src.indexOf("import T"));
});

test("typeImports finds import type, @import and import().T forms", () => {
  const src = `import type { A } from "@bootstrapp/a";
/** @import { B } from "@bootstrapp/b/types.ts" */
/** @type {import("@bootstrapp/c").C} */
const x = 1;
`;
  assert.deepEqual(typeImports(src).map((i) => i.spec), ["@bootstrapp/a", "@bootstrapp/b/types.ts", "@bootstrapp/c"]);
});
