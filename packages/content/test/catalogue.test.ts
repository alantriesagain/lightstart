// node-only
/**
 * @file A small catalogue app: a `content` store's model is built into list
 * and whole-row files, is not seeded through `.light/content`, and reads back
 * through the content adapter over the built folder.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import type { AppManifest } from "@lightstart/app/manifest.ts";
import { generate } from "@lightstart/app/node/generate.ts";
import { openApp } from "@lightstart/app/test";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import contentBuild from "../cli/extend/build.ts";
import { ContentAdapterType } from "../store.ts";

const fixture = fileURLToPath(new URL("./fixtures/catalogue", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-content-catalogue-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  const modules = join(project, "node_modules", "@lightstart");
  mkdirSync(modules, { recursive: true });
  const from = join(fixture, "node_modules", "@lightstart");
  for (const name of readdirSync(from)) symlinkSync(realpathSync(join(from, name)), join(modules, name), "dir");
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const generated = await generate(project);
    ok("the catalogue fixture generates", generated !== null);
    if (generated === null) return done();

    const seeded = join(generated.dir, "content.js");
    ok("the model in the memory store keeps its .light/content seed", existsSync(seeded));
    const seedSource = readFileSync(seeded, "utf8");
    ok("that seed holds the note folder", seedSource.includes('"slug": "welcome"'));
    ok("and leaves the content-store model out", !seedSource.includes("alpha"));

    const mainSource = readFileSync(generated.main, "utf8");
    ok("the entry imports the content adapter type", mainSource.includes("@lightstart/content/store.ts") && mainSource.includes("new ProjectAdapter0()"));
    ok("and passes it to start", mainSource.includes("adapters: [new ProjectAdapter0()]"));

    const api = createBuildExtension({ root: project, minify: false });
    await contentBuild.setup(undefined as never, {} as never, api);
    const report = await build({ root: project, minify: false }, api);
    ok("the catalogue fixture builds", report.files.length > 0);

    const listPath = join(report.dir, "content", "guide.json");
    ok("the build writes the content-store list", existsSync(listPath));
    const listSource = readFileSync(listPath, "utf8");
    const list = JSON.parse(listSource) as Array<Record<string, unknown>>;
    eq("one list row per Markdown file", String(list.length), "3");
    ok("the list leaves the heavy fields out", !listSource.includes("setup") && !listSource.includes("cues") && !listSource.includes("mistakes"));
    ok("the list rows carry id and slug", list.every((row) => row["id"] !== undefined && row["slug"] !== undefined));

    const rowPath = join(report.dir, "content", "guide", "alpha.json");
    ok("the build writes a whole row file", existsSync(rowPath));
    const alpha = JSON.parse(readFileSync(rowPath, "utf8")) as Record<string, unknown>;
    ok("the whole row holds the heavy fields", Array.isArray(alpha["setup"]) && Array.isArray(alpha["cues"]) && Array.isArray(alpha["mistakes"]));
    ok("a model outside the content store writes no list", !existsSync(join(report.dir, "content", "note.json")));

    const manifest = (await import(pathToFileURL(generated.manifest).href)) as { default: AppManifest };
    const fake: typeof fetch = async (input) => {
      const pathname = new URL(String(input), "http://content.test").pathname;
      const file = join(report.dir, pathname.replace(/^\/+/, ""));
      return existsSync(file) ? new Response(readFileSync(file, "utf8"), { status: 200 }) : new Response("{}", { status: 404 });
    };
    const app = await openApp(manifest.default, { adapters: [new ContentAdapterType({ fetch: fake })] });
    try {
      const guide = manifest.default.models.find((entry) => entry.name === "guide")?.model;
      const note = manifest.default.models.find((entry) => entry.name === "note")?.model;
      if (guide === undefined || note === undefined) throw new Error("the fixture models are missing");

      const rows = await guide.getAll();
      eq("the content store answers every guide", String(rows.length), "3");
      const core = await guide.getAll({ where: { areas: { has: ["core"] } } });
      eq("has filters through the memory adapter", core.map((row) => String(row["id"])).sort().join(","), "alpha,gamma");
      eq("count agrees", String(await guide.count({ where: { areas: { has: ["core"] } } })), "2");

      const whole = await guide.get("alpha");
      ok("get by slug answers the heavy fields", Array.isArray(whole?.["setup"]) && (whole["setup"] as unknown[]).length === 2);
      eq("the seeded note still reads from memory", String((await note.getAll()).length), "1");
    } finally {
      await app.stop();
    }

    writeFileSync(join(project, "src", "app.js"), 'import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "catalogue", host: "web", worker: true, stores: { main: { adapter: "memory" }, catalogue: { adapter: "content" } } });\n');
    const workerGenerated = await generate(project);
    ok("a worker app generates too", workerGenerated !== null);
    if (workerGenerated !== null) {
      const workerSource = readFileSync(join(workerGenerated.dir, "worker.js"), "utf8");
      ok("the worker registers the content adapter type", workerSource.includes("@lightstart/content/store.ts") && workerSource.includes("registerAdapterType(new ProjectAdapter0())"));
      const pageSource = readFileSync(workerGenerated.main, "utf8");
      ok("the page imports no content adapter type", !pageSource.includes("@lightstart/content/store.ts"));
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
