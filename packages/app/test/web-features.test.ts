// node-only
/**
 * @file A built web page bundles only the host features its config uses: a
 * memory app without transitions or arguments carries none of their code, and
 * the same fixture with every feature on carries each, both booting under
 * `openBuilt` without an error.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { openBuilt } from "../web/test.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));
const typed = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const rpc = fileURLToPath(new URL("../../rpc", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-web-features-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  const modules = join(project, "node_modules");
  mkdirSync(modules);
  const source = join(typed, "node_modules");
  for (const name of readdirSync(source)) {
    if (name === "@lightstart") {
      mkdirSync(join(modules, name));
      for (const sub of readdirSync(join(source, name))) symlinkSync(realpathSync(join(source, name, sub)), join(modules, name, sub), "dir");
    } else symlinkSync(realpathSync(join(source, name)), join(modules, name), "dir");
  }
  symlinkSync(rpc, join(modules, "@lightstart", "rpc"), "dir");
  return project;
};

const writeApp = (project: string, source: string): void => {
  writeFileSync(join(project, "src", "app.js"), source);
};

const MEMORY = 'import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web-js", title: "Fixture Web", host: "web", stores: { main: { adapter: "memory" } } });\n';
const EVERYTHING = 'import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web-js", title: "Fixture Web", host: "web", transitions: true, args: { greeting: { default: "hi" } }, stores: { main: { adapter: "indexeddb" }, archive: { adapter: "memory", worker: true } } });\n';

const builtChunkOf = (dir: string): string => {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const found = /<script[^>]+src="([^"]+\.js)"/.exec(html);
  if (found?.[1] === undefined) throw new Error("the built page names no script");
  return found[1].replace(/^\/+/, "");
};

const buildFixture = async (source: string): Promise<{ project: string; dir: string; entry: string; sources: string[] }> => {
  const project = copy();
  writeApp(project, source);
  const api = createBuildExtension({ root: project, minify: false });
  await appBuild.setup(undefined as never, { prerender: false } as never, api);
  const report = await build({ root: project, minify: false }, api);
  const scripts = report.files.filter((file) => file.path.endsWith(".js"));
  return { project, dir: report.dir, entry: builtChunkOf(report.dir), sources: scripts.map((file) => readFileSync(join(report.dir, file.path), "utf8")) };
};

const IDB = "_expectedStores";
const WORKER = "WorkerConnection";
const MORPH = "light-morph";
const ARGV = "takes the rest, so it must be the last positional";

const main = async (): Promise<void> => {
  const plain = await buildFixture(MEMORY);
  try {
    ok("a memory app carries no IndexedDB adapter", !plain.sources.some((script) => script.includes(IDB)));
    ok("a memory app carries no worker connection", !plain.sources.some((script) => script.includes(WORKER)));
    ok("an app without transitions carries no morph styles", !plain.sources.some((script) => script.includes(MORPH)));
    ok("an app without args carries no argv parser", !plain.sources.some((script) => script.includes(ARGV)));
    const page = await openBuilt(plain.dir, "/");
    try {
      ok("the plain built page boots without an error", page.errors.length === 0 && page.failed.length === 0);
      ok("the plain built page draws the app", (await page.text()).includes("Seeded note"));
    } finally {
      await page.close();
    }
  } finally {
    rmSync(plain.project, { recursive: true, force: true });
  }

  const rich = await buildFixture(EVERYTHING);
  try {
    const source = readFileSync(join(rich.dir, rich.entry), "utf8");
    ok("the app that names IndexedDB carries its adapter", rich.sources.some((script) => script.includes(IDB)));
    ok("the app with a worker store carries the worker connection", source.includes(WORKER));
    ok("the app with transitions carries the morph styles", source.includes(MORPH));
    ok("the app with args carries the argv parser", source.includes(ARGV));
    ok("the worker entry is built beside the page", existsSync(join(rich.dir, "worker.js")));
    const page = await openBuilt(rich.dir, "/");
    try {
      ok("the feature-rich built page boots without an error", page.errors.length === 0 && page.failed.length === 0);
      ok("the feature-rich built page draws the app", (await page.text()).includes("Seeded note"));
    } finally {
      await page.close();
    }
  } finally {
    rmSync(rich.project, { recursive: true, force: true });
  }
  done();
};

await main();
