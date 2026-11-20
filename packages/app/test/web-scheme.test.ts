// node-only
/**
 * @file A dark app's built page: `renderPage` puts `class="dark"` on
 * `<html>` before any script runs, so a prerendered page paints dark first.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-scheme-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  writeFileSync(join(project, "src", "app.ts"), 'import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web", host: "web", url: "https://fixture.example", scheme: "dark" });\n');
  return project;
};

const buildOf = async (project: string): Promise<string> => {
  const api = createBuildExtension({ root: project, minify: false });
  await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
  const report = await build({ root: project, minify: false }, api);
  return report.dir;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const dir = await buildOf(project);
    const home = readFileSync(join(dir, "index.html"), "utf8");
    ok("the dark app's page carries the dark class on <html>", /<html[^>]*\sclass="dark"/.test(home));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
