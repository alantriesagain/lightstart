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
import contentServe from "../cli/extend/serve.ts";
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
    eq("one list row per record", String(list.length), "4");
    ok("the list leaves the heavy fields out", !listSource.includes("setup") && !listSource.includes("cues") && !listSource.includes("mistakes"));
    ok("the list leaves the private field out", !listSource.includes("notes"));
    ok("the list rows carry id and slug", list.every((row) => row["id"] !== undefined && row["slug"] !== undefined));
    ok("a JSON record is one list row", list.some((row) => row["slug"] === "delta" && row["title"] === "Delta guide"));

    const rowPath = join(report.dir, "content", "guide", "alpha.json");
    ok("the build writes a whole row file", existsSync(rowPath));
    const alpha = JSON.parse(readFileSync(rowPath, "utf8")) as Record<string, unknown>;
    ok("the whole row holds the heavy fields", Array.isArray(alpha["setup"]) && Array.isArray(alpha["cues"]) && Array.isArray(alpha["mistakes"]));
    ok("the whole row leaves the private field out", alpha["notes"] === undefined);
    ok("a model outside the content store writes no list", !existsSync(join(report.dir, "content", "note.json")));

    const ptListPath = join(report.dir, "content", "guide.pt.json");
    ok("the build writes a per-locale list", existsSync(ptListPath));
    const ptList = JSON.parse(readFileSync(ptListPath, "utf8")) as Array<Record<string, unknown>>;
    const ptAlpha = ptList.find((row) => row["slug"] === "alpha");
    eq("the per-locale list holds the overlay", String(ptAlpha?.["title"]), "Guia Alfa");
    ok("a translation leaves non-localized fields alone", JSON.stringify(ptAlpha?.["areas"]) === '["core","start"]');
    ok("a per-locale list leaves the private field out", !readFileSync(ptListPath, "utf8").includes("notes"));
    const ptRowPath = join(report.dir, "content", "guide", "alpha.pt.json");
    ok("the build writes a per-locale whole row", existsSync(ptRowPath));
    const ptAlphaRow = JSON.parse(readFileSync(ptRowPath, "utf8")) as Record<string, unknown>;
    eq("the per-locale row holds the translated heavy field", JSON.stringify(ptAlphaRow["setup"]), '["Abrir o painel"]');

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
      eq("the content store answers every guide", String(rows.length), "4");
      const core = await guide.getAll({ where: { areas: { has: ["core"] } } });
      eq("has filters through the memory adapter", core.map((row) => String(row["id"])).sort().join(","), "alpha,gamma");
      eq("count agrees", String(await guide.count({ where: { areas: { has: ["core"] } } })), "2");

      const whole = await guide.get("alpha");
      ok("get by slug answers the heavy fields", Array.isArray(whole?.["setup"]) && (whole["setup"] as unknown[]).length === 2);
      eq("the seeded note still reads from memory", String((await note.getAll()).length), "1");

      const portuguese = await guide.getAll({ locale: "pt" });
      const ptAlpha = portuguese.find((row) => row["slug"] === "alpha");
      eq("a locale query reads the translation", String(ptAlpha?.["title"]), "Guia Alfa");
      const ptDelta = portuguese.find((row) => row["slug"] === "delta");
      eq("a record with its own translation follows it", String(ptDelta?.["title"]), "Guia Delta");
      const ptBeta = portuguese.find((row) => row["slug"] === "beta");
      eq("a record without a translation keeps its default", String(ptBeta?.["title"]), "Beta guide");
      eq("a locale query keeps every row", String(portuguese.length), "4");

      const ptWhole = await guide.get("alpha", { locale: "pt" });
      eq("get takes the locale option", String(ptWhole?.["title"]), "Guia Alfa");
      ok("get keeps the translated heavy field", JSON.stringify(ptWhole?.["setup"]) === '["Abrir o painel"]');

      const spanish = await guide.getAll({ locale: "es" });
      eq("a locale with no variant falls back to the default", String(spanish.find((row) => row["slug"] === "alpha")?.["title"]), "Alpha guide");
      eq("a fallback locale does not load the rows twice", String(spanish.length), "4");
      eq("the default list still answers once per row", String((await guide.getAll()).length), "4");

      const route = { handler: null as null | ((c: { param(name: string): string | null }) => Promise<unknown>) };
      const serveApi = {
        app: {
          get(_path: string, handler: (c: { param(name: string): string | null }) => Promise<unknown>): void {
            route.handler = handler;
          },
        },
      };
      await contentServe.setup({ projectDir: project } as never, {} as never, serveApi as never);
      if (route.handler === null) throw new Error("the content serve extension registered no route");
      const call = async (rest: string): Promise<{ status: number; text: string | null }> =>
        (await route.handler?.({ param: (name) => (name === "*" ? rest : null) })) as { status: number; text: string | null };

      const served = await call("guide.pt.json");
      eq("serve answers a locale path", String(served.status), "200");
      const servedList = JSON.parse(served.text ?? "[]") as Array<Record<string, unknown>>;
      eq("serve reads the locale list from source", String(servedList.find((row) => row["slug"] === "alpha")?.["title"]), "Guia Alfa");
      ok("serve leaves the private field out", !(served.text ?? "").includes("notes"));
      const servedRow = await call("guide/alpha.pt.json");
      eq("serve answers a locale row path", String(servedRow.status), "200");
      eq("serve reads the locale row from source", JSON.stringify((JSON.parse(servedRow.text ?? "{}") as Record<string, unknown>)["setup"]), '["Abrir o painel"]');
      eq("a locale with no variant is 404 from serve", String((await call("guide.es.json")).status), "404");
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
