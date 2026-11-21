// node-only
/**
 * @file The worker fixture's build: the worker is bundled under the fixed name
 * `worker.js` beside the page's bundle, `_headers` does not cache it for good
 * because its name carries no build hash, and the page's bundle carries none
 * of the engine store the worker runs. A non-worker app still builds with the
 * engine on its page.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { generate } from "../node/generate.ts";

const workerFixture = fileURLToPath(new URL("./fixtures/worker", import.meta.url));
const plainFixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));

/** Strings only the engine modules hold: the store, the relationship loader, the query builder's checks and validation. */
const ENGINE = [
  ["store", "is not mapped to any database"],
  ["relationship loader", "polymorphic_model_not_found"],
  ["query builder", "limit must be a positive number"],
  ["validation", ".validator is not a function"],
] as const;

interface Built {
  project: string;
  dir: string;
  scripts: string[];
}

const copy = (source: string): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-worker-build-"));
  cpSync(source, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(source, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

/** The scripts `start` loads, following its relative imports (and its dynamic ones). */
const reachable = (dir: string, start: string): string[] => {
  const seen = new Set<string>();
  const visit = (path: string): void => {
    if (seen.has(path)) return;
    let source = "";
    try {
      source = readFileSync(join(dir, path), "utf8");
    } catch {
      return;
    }
    seen.add(path);
    for (const match of source.matchAll(/\bfrom\s*["']\.\/([^"']+\.js)["']|\bimport\s*\(\s*["']\.\/([^"']+\.js)["']|\bimport\s*["']\.\/([^"']+\.js)["']/g)) {
      const next = match[1] ?? match[2] ?? match[3];
      if (next !== undefined) visit(next);
    }
  };
  visit(start);
  return [...seen];
};

const buildFixture = async (source: string, label: string): Promise<Built> => {
  const project = copy(source);
  const generated = await generate(project);
  if (generated === null) throw new Error(`the ${label} fixture did not generate`);
  const api = createBuildExtension({ root: project, minify: false });
  await appBuild.setup(undefined as never, {} as never, api);
  const report = await build({ root: project, minify: false }, api);
  return { project, dir: report.dir, scripts: report.files.filter((file) => file.path.endsWith(".js")).map((file) => file.path) };
};

const main = async (): Promise<void> => {
  const worker = await buildFixture(workerFixture, "worker");
  try {
    ok("the worker fixture builds", worker.scripts.length > 1);
    ok("the build writes worker.js beside the page's bundle", worker.scripts.includes("worker.js"));

    const headers = readFileSync(join(worker.dir, "_headers"), "utf8");
    ok("worker.js is not cached for good", !headers.includes("worker.js\n  Cache-Control: public, max-age=31536000, immutable"));

    const html = readFileSync(join(worker.dir, "index.html"), "utf8");
    const found = /<script[^>]+src="([^"]+\.js)"/.exec(html);
    if (found?.[1] === undefined) throw new Error("the worker fixture's page names no script");
    const page = reachable(worker.dir, found[1].replace(/^\/+/, "")).map((path) => readFileSync(join(worker.dir, path), "utf8"));
    const workerSource = reachable(worker.dir, "worker.js").map((path) => readFileSync(join(worker.dir, path), "utf8"));
    for (const [name, message] of ENGINE) {
      ok(`a worker app's page carries none of the ${name}`, !page.some((source) => source.includes(message)));
      ok(`the worker carries the ${name}`, workerSource.some((source) => source.includes(message)));
    }
  } finally {
    rmSync(worker.project, { recursive: true, force: true });
  }

  const plain = await buildFixture(plainFixture, "plain");
  try {
    const html = readFileSync(join(plain.dir, "index.html"), "utf8");
    const found = /<script[^>]+src="([^"]+\.js)"/.exec(html);
    if (found?.[1] === undefined) throw new Error("the plain fixture's page names no script");
    const scripts = reachable(plain.dir, found[1].replace(/^\/+/, "")).map((path) => readFileSync(join(plain.dir, path), "utf8"));
    for (const [name, message] of ENGINE) ok(`a non-worker app's page carries the ${name}`, scripts.some((source) => source.includes(message)));
  } finally {
    rmSync(plain.project, { recursive: true, force: true });
  }
  done();
};

await main();
