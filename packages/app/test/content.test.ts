// node-only
/**
 * @file A project on `@lightstart/content`: its `content/note` folder becomes
 * `.light/content.js`, the row reaches the store through the manifest's seeds, a build's entry
 * carries no Markdown parser, and the prerendered home page draws the body's text.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { generate as generateProject } from "../node/generate.ts";
import type { AppManifest } from "../manifest.ts";
import { openApp } from "../test/index.ts";
import { latestBuild, openBuilt } from "../web/test.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));
const typed = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const content = fileURLToPath(new URL("../../content", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-content-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  const modules = join(project, "node_modules");
  const from = join(typed, "node_modules");
  mkdirSync(modules);
  for (const name of readdirSync(from)) {
    if (name === "@lightstart") {
      mkdirSync(join(modules, name));
      for (const sub of readdirSync(join(from, name))) symlinkSync(realpathSync(join(from, name, sub)), join(modules, name, sub), "dir");
    } else symlinkSync(realpathSync(join(from, name)), join(modules, name), "dir");
  }
  symlinkSync(content, join(modules, "@lightstart", "content"), "dir");
  return project;
};

const addContent = (project: string): void => {
  const pkgPath = join(project, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...(pkg.dependencies ?? {}), "@lightstart/content": "workspace:*" };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  writeFileSync(
    join(project, "src", "models", "note.js"),
    'import T from "@lightstart/light/types";\nimport { defineModel } from "@lightstart/light/model";\n\nexport default defineModel("note", {\n  text: T.string({ required: true }),\n  body: T.array(),\n});\n',
  );
  const folder = join(project, "content", "note");
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "first.md"),
    "---\ntext: Content note\n---\n\n# First note\n\nA paragraph with **bold** text.\n",
  );
  writeFileSync(
    join(project, "src", "views", "app-home.js"),
    'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\nimport { renderContent } from "@lightstart/content/render";\nimport notes from "../controllers/notes.js";\n\nclass AppHome extends View {\n  render() {\n    const rows = notes.rows.value;\n    return html`<lc-card><lc-text>Home</lc-text><ul>${rows.map((row) => html`<li>${String(row.text)}${Array.isArray(row.body) ? renderContent(row.body) : ""}</li>`)}</ul></lc-card><lc-code-block language="javascript" code="const answer = 42;"></lc-code-block><div class="tall" style="height: 2500px"></div>`;\n  }\n}\n\nView.register("app-home", AppHome);\n',
  );
};

const builtChunkOf = (dir: string): string => {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const found = /<script[^>]+src="([^"]+\.js)"/.exec(html);
  if (found?.[1] === undefined) throw new Error("the built page names no script");
  return found[1].replace(/^\/+/, "");
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    addContent(project);
    const generated = await generateProject(project);
    ok("the content fixture generates", generated !== null);
    if (generated === null) return done();

    const path = join(generated.dir, "content.js");
    ok("a project on content gets .light/content.js", existsSync(path));
    const source = readFileSync(path, "utf8");
    ok("it holds the collection's row", source.includes('"slug": "first"') && source.includes('"text": "Content note"'));
    ok("its body is JSON blocks", source.includes('"type": "heading"') && source.includes('"type": "paragraph"'));
    ok("the manifest imports it", readFileSync(generated.manifest, "utf8").includes('import content from "./content.js";'));
    ok("and seeds it before src/seed", readFileSync(generated.manifest, "utf8").indexOf("content,") < readFileSync(generated.manifest, "utf8").indexOf("seed0,"));

    const manifest = (await import(pathToFileURL(generated.manifest).href)) as { default: AppManifest };
    const app = await openApp(manifest.default);
    try {
      const note = manifest.default.models.find((entry) => entry.name === "note")?.model;
      if (note === undefined) throw new Error("the note model is missing");
      const rows = await note.getAll({});
      eq("the content row and the seed row are in the store", String(rows.length), "2");
      ok("the content row keeps its slug", rows.some((row) => row["slug"] === "first"));
      ok("and its body", rows.some((row) => Array.isArray(row["body"]) && (row["body"] as { type?: string }[])[0]?.type === "heading"));
    } finally {
      await app.stop();
    }

    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
    const report = await build({ root: project, minify: false }, api);
    ok("the content fixture builds", report.files.length > 0);

    const newest = await latestBuild(project);
    ok("the build is current", newest.endsWith(join(".deployed", "current")));
    const entry = builtChunkOf(report.dir);
    const entrySource = readFileSync(join(report.dir, entry), "utf8");
    ok("the page's entry bundle carries no Markdown parser", !entrySource.includes("setext"));

    const home = await openBuilt(report.dir, "/");
    try {
      const text = await home.text();
      ok("the built home page draws the body's heading", text.includes("First note"));
      ok("and its paragraph's markup", text.includes("bold"));
      ok("the built home page boots without an error", home.errors.length === 0 && home.failed.length === 0);
    } finally {
      await home.close();
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
