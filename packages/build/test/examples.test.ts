// node-only
/**
 * @file Pages build: the todomvc fixture (an importmap of exact keys, a `.ts` module through a
 * JSDoc import), the starter fixture (trailing-slash prefixes, stylesheets outside the app folder,
 * an inline module script with a dynamic import), and the tasks-web example (an app on
 * `@lightstart/app`, its `.light/` generated first, as `light build` does).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../build.ts";
import { done, ok } from "@lightstart/test/assert.ts";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));
const examples = fileURLToPath(new URL("../../../examples", import.meta.url));
const roots: [string, string][] = [
  ["todomvc", join(fixtures, "todomvc")],
  ["starter", join(fixtures, "starter")],
  ["tasks-web", join(examples, "tasks-web")],
];

/** Generate the app's `.light/` in `root`, as `light build` does first: `light app`, from this checkout's CLI. */
const generate = (root: string): void => {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url)), "app"], { cwd: root, stdio: "ignore" });
};

const main = async (): Promise<void> => {
  generate(join(examples, "tasks-web"));
  for (const [name, root] of roots) {
    const out = mkdtempSync(join(tmpdir(), `light-build-${name}-`));
    try {
      const report = await build({ root, outDir: out });
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
