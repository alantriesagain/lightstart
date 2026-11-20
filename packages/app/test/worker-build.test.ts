// node-only
/**
 * @file The worker fixture's build: the worker is bundled under the fixed name
 * `worker.js` beside the page's bundle, and `_headers` does not cache it for
 * good because its name carries no build hash.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/worker", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-worker-build-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const generated = await generate(project);
    ok("the worker fixture generates", generated !== null);
    if (generated === null) return done();

    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, {} as never, api);
    const report = await build({ root: project, minify: false }, api);
    ok("the worker fixture builds", report.files.length > 0);
    ok("the build writes worker.js beside the page's bundle", report.files.some((file) => file.path === "worker.js"));

    const headers = readFileSync(join(report.dir, "_headers"), "utf8");
    ok("worker.js is not cached for good", !headers.includes("worker.js\n  Cache-Control: public, max-age=31536000, immutable"));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
