// node-only
/**
 * @file What `light build --prerender --renderer markup` writes: every
 * concrete route's `index.html` holds the rendered page and the adopt marker,
 * while `404.html` stays the unrendered shell. Parameter routes are filled from
 * `params`. The markup renderer runs in node, so this test needs no Playwright.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { PRERENDER_SCRIPT } from "../node/prerender.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-prerender-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  const page = join(project, "index.html");
  writeFileSync(page, readFileSync(page, "utf8").replace("./.light/main.ts", "/.light/main.ts"));
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
    writeFileSync(
      join(project, "src", "routes.ts"),
      'export default {\n  "/": { name: "home", title: "Home", view: "app-home" },\n  "/about": { name: "about", title: "About", view: "app-about" },\n  "/notes/:id": { name: "note", title: "Note", view: "app-about", params: () => [{ id: "1" }, { id: "2" }] },\n};\n',
    );
    const dir = await buildOf(project);

    const home = readFileSync(join(dir, "index.html"), "utf8");
    ok("the home page starts with a doctype", home.startsWith("<!doctype html>"));
    ok("the home page is rendered", home.includes("<p>Home</p>"));
    ok("the home page marks itself prerendered", home.includes(PRERENDER_SCRIPT));

    const about = readFileSync(join(dir, "about", "index.html"), "utf8");
    ok("the about page is rendered", about.includes("<p>About</p>"));
    ok("the about page marks itself prerendered", about.includes(PRERENDER_SCRIPT));

    for (const id of ["1", "2"]) {
      const note = readFileSync(join(dir, "notes", id, "index.html"), "utf8");
      ok(`the note ${id} page is rendered`, note.includes("<p>About</p>"));
      ok(`the note ${id} page marks itself prerendered`, note.includes(PRERENDER_SCRIPT));
    }

    const shell = readFileSync(join(dir, "404.html"), "utf8");
    ok("404.html is not rendered", !shell.includes("<p>Home</p>"));
    ok("404.html is not marked prerendered", !shell.includes(PRERENDER_SCRIPT));
    ok("404.html keeps the root placeholder", shell.includes("<app-root></app-root>"));

    const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
    for (const path of ["https://fixture.example/", "https://fixture.example/about", "https://fixture.example/notes/1", "https://fixture.example/notes/2"]) {
      ok(`the sitemap lists ${path}`, sitemap.includes(`<loc>${path}</loc>`));
    }
    ok("the sitemap has no parameter left", !sitemap.includes(":id"));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
