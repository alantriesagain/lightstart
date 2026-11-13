// node-only
/**
 * @file The two examples build: todomvc (an importmap of exact keys, a `.ts` module through a
 * JSDoc import) and starter (trailing-slash prefixes, stylesheets outside the app folder, an
 * inline module script with a dynamic import).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../build.ts";
import { done, ok } from "@light/test/assert.ts";

const examples = fileURLToPath(new URL("../../../examples", import.meta.url));

const main = async (): Promise<void> => {
  for (const name of ["todomvc", "starter"]) {
    const out = mkdtempSync(join(tmpdir(), `light-build-${name}-`));
    try {
      const report = await build({ root: join(examples, name), outDir: out });
      ok(`${name} builds files`, report.files.length > 0);
      ok(`${name} writes its page`, existsSync(join(report.dir, "index.html")));
      const html = readFileSync(join(report.dir, "index.html"), "utf8");
      ok(`${name} has no importmap left`, !html.includes("importmap"));
      ok(`${name} names hashed modules`, /<script type="module" src="\.\/[^"]+-[A-Z0-9]+\.js"><\/script>/.test(html));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }
  done();
};

await main();
