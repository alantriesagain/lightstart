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
import type { AppManifest } from "../manifest.ts";
import { generate as generateProject } from "../node/generate.ts";
import { openApp } from "../test/index.ts";
import { JsonlKind } from "../tui/index.ts";
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
    ok("the manifest imports the seed", source.includes('import seed0 from "../src/seed.js";'));
    ok("the manifest imports the dev seed", source.includes('import seed1 from "../src/seed.dev.js";'));
    ok("the manifest carries both seeds", source.includes("  seeds: [\n    seed0,\n    seed1,\n  ],"));

    const components = join(project, ".light", "components.js");
    ok("the components module is JavaScript", existsSync(components) && !existsSync(join(project, ".light", "components.ts")));
    const componentSource = readFileSync(components, "utf8");
    ok("the components module has no TypeScript syntax", !componentSource.includes("import type") && !/\sas\s/.test(componentSource));
    ok("the manifest imports the components with .js", source.includes('import "./components.js";'));

    const module = (await import(`${pathToFileURL(generated.manifest).href}?mtime=${String(Date.now())}`)) as { default?: AppManifest };
    const manifest = module.default;
    ok("node imports the generated JavaScript directly", manifest !== undefined && Array.isArray(manifest.views));
    if (manifest === undefined) return done();

    const seeded = await openApp(manifest);
    try {
      eqn("the base seed adds its row", (await seeded.store.getAll("note")).length, 1);
      eqn("the dev seed adds its row too", (await seeded.store.getAll("tag")).length, 1);
    } finally {
      await seeded.stop();
    }

    const unseeded = await openApp(manifest, { seed: false });
    try {
      eqn("openApp can skip the seeds", (await unseeded.store.getAll("note")).length, 0);
    } finally {
      await unseeded.stop();
    }

    const data = mkdtempSync(join(tmpdir(), "light-app-seed-data-"));
    try {
      const first = await openApp(manifest, { args: { data }, kinds: [new JsonlKind()] });
      eqn("the first run seeds the store", (await first.store.getAll("note")).length, 1);
      await first.stop();
      const second = await openApp(manifest, { args: { data }, kinds: [new JsonlKind()] });
      eqn("a second run adds nothing to the store", (await second.store.getAll("note")).length, 1);
      await second.stop();
    } finally {
      rmSync(data, { recursive: true, force: true });
    }

    const both = await openApp({ ...manifest, seeds: [{ note: [{ text: "From the seed" }] }, { note: [{ text: "From the dev seed" }] }] });
    try {
      eqn("the seed and the dev seed both fill a fresh model", (await both.store.getAll("note")).length, 2);
    } finally {
      await both.stop();
    }

    let unknown = "";
    try {
      await openApp({ ...manifest, seeds: [{ missing: [{ text: "x" }] }] });
    } catch (error) {
      unknown = error instanceof Error ? error.message : String(error);
    }
    ok("a seed naming no model names it", unknown.includes('"missing"'));

    let invalid = "";
    try {
      await openApp({ ...manifest, seeds: [{ note: [{}] }] });
    } catch (error) {
      invalid = error instanceof Error ? error.message : String(error);
    }
    ok("a bad seed row names the model and its index", invalid.includes('model "note"') && invalid.includes("row 0"));

    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
    const report = await build({ root: project, minify: false }, api);
    ok("light build writes the JavaScript app", existsSync(join(report.dir, "index.html")) && existsSync(join(report.dir, "404.html")));

    const builtSource = readFileSync(generated.manifest, "utf8");
    ok("the build leaves the dev seed out", !builtSource.includes("seed.dev.js") && builtSource.includes('import seed0 from "../src/seed.js";'));
    const home = readFileSync(join(report.dir, "index.html"), "utf8");
    ok("the prerendered page holds a seeded row", home.includes("Seeded note"));

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
