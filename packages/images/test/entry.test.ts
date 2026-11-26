// node-only
/**
 * @file The main entry stays what a page and a Worker share: following its
 * imports from `index.ts` reaches no `node:` module and no Playwright, while
 * `node.ts` holds the resize engine and the normalize step.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, ok } from "@lightstart/test/assert.ts";

const here = dirname(fileURLToPath(import.meta.url));
const IMPORT = /(?:import|export)\s[^;]*?from\s+"([^"]+)"|import\(\s*"([^"]+)"\s*\)/g;

const reached = (entry: string): string[] => {
  const seen = new Set<string>();
  const bare: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? "";
      if (specifier.startsWith(".")) visit(resolve(dirname(file), specifier));
      else bare.push(specifier);
    }
  };
  visit(entry);
  return bare;
};

const main = reached(join(here, "..", "index.ts"));
eq("the main entry reaches no node: module", JSON.stringify(main.filter((specifier) => specifier.startsWith("node:"))), "[]");
eq("the main entry reaches no Playwright", JSON.stringify(main.filter((specifier) => specifier.includes("playwright"))), "[]");

const node = await import("../node.ts");
ok("the node entry has the resize engine", typeof node.createResizer === "function");
ok("the node entry has the normalize step", typeof node.normalizeImages === "function" && typeof node.imagesConfig === "function");
const shared = await import("../index.ts");
ok("the main entry keeps the shared pieces", typeof shared.imageSize === "function" && typeof shared.variantUrl === "function" && typeof shared.resizeImage === "function");
ok("the main entry no longer has the resize engine", !("createResizer" in shared));
done();
