// node-only
/**
 * @file The order controllers start in: after the controllers they import,
 * otherwise by name, an `import type` not counting, and a cycle an error that
 * names it.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const project = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), "light-app-order-"));
  mkdirSync(join(dir, "src", "controllers"), { recursive: true });
  writeFileSync(join(dir, "src", "app.ts"), 'export default { name: "order", host: "web" };\n');
  for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, "src", "controllers", name), source);
  return dir;
};

const startOrder = (dir: string): string => {
  const manifest = readFileSync(join(dir, ".light", "app.ts"), "utf8");
  return [...manifest.matchAll(/\{ name: "([^"]+)", controller:/g)].map((match) => match[1]).join(",");
};

const main = async (): Promise<void> => {
  const ordered = project({
    "alpha.ts": 'import zeta from "./zeta.ts";\nimport type { Mid } from "./mid.ts";\nexport default { zeta };\n',
    "mid.ts": 'export type Mid = number;\nexport default {};\n',
    "zeta.ts": 'import "./omega";\nexport default {};\n',
    "omega.ts": "export default {};\n",
  });
  try {
    const generated = await generate(ordered);
    eq("taken by name, each after the controllers it imports", generated === null ? "" : generated.controllers.join(","), "omega,zeta,alpha,mid");
    eq("the manifest lists them in that order", startOrder(ordered), "omega,zeta,alpha,mid");
  } finally {
    rmSync(ordered, { recursive: true, force: true });
  }

  const cyclic = project({
    "a.ts": 'import b from "./b.ts";\nexport default { b };\n',
    "b.ts": 'import a from "./a.ts";\nexport default { a };\n',
  });
  try {
    let message = "";
    try {
      await generate(cyclic);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    ok("a cycle is an error that names it", message.includes("a cycle: a → b → a"));
  } finally {
    rmSync(cyclic, { recursive: true, force: true });
  }
  done();
};

await main();
