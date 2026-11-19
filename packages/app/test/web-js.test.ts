// node-only
/**
 * @file A web app written in JavaScript: the generation writes `.light/*.js`
 * with no TypeScript syntax, `light build` (and prerender) reads it, and
 * `openPage` boots it in Chromium.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { generate as generateProject } from "../node/generate.ts";
import { done, eqn, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));
const typed = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-web-js-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(typed, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const generated = await generateProject(project);
    ok("the JavaScript app generates", generated !== null);
    if (generated === null) return done();

    ok("the manifest is JavaScript", generated.manifest.endsWith(".light/app.js") && existsSync(generated.manifest));
    ok("the entry is JavaScript", generated.main.endsWith(".light/main.js") && existsSync(generated.main));
    ok("there is no .light/app.ts", !existsSync(join(project, ".light", "app.ts")) && !existsSync(join(project, ".light", "main.ts")));

    const source = readFileSync(generated.manifest, "utf8");
    ok("the manifest imports the app with .js", source.includes('import app from "../src/app.js";'));
    ok("the manifest imports a model with .js", source.includes('import model0 from "../src/models/note.js";'));
    ok("the manifest imports a view with .js", source.includes('import "../src/views/app-home.js";'));
    ok("the manifest has no import type", !source.includes("import type"));
    ok("the manifest has no type annotation", !/const manifest:/.test(source));
    ok("the manifest has no satisfies", !source.includes("satisfies"));
    ok("the manifest has no as cast", !/\sas\s/.test(source));

    const components = join(project, ".light", "components.js");
    ok("the components module is JavaScript", existsSync(components) && !existsSync(join(project, ".light", "components.ts")));
    const componentSource = readFileSync(components, "utf8");
    ok("the components module has no TypeScript syntax", !componentSource.includes("import type") && !/\sas\s/.test(componentSource));
    ok("the manifest imports the components with .js", source.includes('import "./components.js";'));

    const module = (await import(`${pathToFileURL(generated.manifest).href}?mtime=${String(Date.now())}`)) as { default?: { views?: unknown } };
    ok("node imports the generated JavaScript directly", module.default !== undefined && Array.isArray(module.default.views));

    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
    const report = await build({ root: project, minify: false }, api);
    ok("light build writes the JavaScript app", existsSync(join(report.dir, "index.html")) && existsSync(join(report.dir, "404.html")));

    const run = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/app.browser.js"], {
      cwd: project,
      env: { ...process.env, LIGHT_PROJECT_DIR: project, NO_COLOR: "1" },
      encoding: "utf8",
    });
    eqn("openPage boots the JavaScript app in Chromium", run.status ?? 1, 0);
    if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
