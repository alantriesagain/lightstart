// node-only
/**
 * @file What `light build --prerender --renderer browser` writes: every
 * concrete route's `index.html` holds the page rendered in headless Chromium
 * and the adopt marker, while `404.html` stays the unrendered shell.
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
  const project = mkdtempSync(join(tmpdir(), "light-app-prerender-browser-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  const page = join(project, "index.html");
  writeFileSync(page, readFileSync(page, "utf8").replace("./.light/main.ts", "/.light/main.ts"));
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    writeFileSync(
      join(project, "src", "routes.ts"),
      'export default {\n  "/": { name: "home", title: "Home", view: "app-home" },\n  "/about": { name: "about", title: "About", view: "app-about" },\n  "/notes/:id": { name: "note", title: "Note", view: "app-about", params: () => [{ id: "1" }, { id: "2" }] },\n};\n',
    );
    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "browser" } as never, api);
    const dir = (await build({ root: project, minify: false }, api)).dir;

    const home = readFileSync(join(dir, "index.html"), "utf8");
    ok("the browser-rendered home page starts with a doctype", home.startsWith("<!doctype html>"));
    ok("the browser-rendered home page is rendered", home.includes("<p>Home</p>"));
    ok("the browser-rendered home page marks itself prerendered", home.includes(PRERENDER_SCRIPT));

    const about = readFileSync(join(dir, "about", "index.html"), "utf8");
    ok("the browser-rendered about page is rendered", about.includes("<p>About</p>"));
    ok("the browser-rendered about page marks itself prerendered", about.includes(PRERENDER_SCRIPT));
    ok("the browser-rendered about page carries its title", about.includes("<title>About | fixture-web</title>"));
    ok("the browser-rendered about page has its canonical", about.includes('rel="canonical" href="https://fixture.example/about"'));

    for (const id of ["1", "2"]) {
      const note = readFileSync(join(dir, "notes", id, "index.html"), "utf8");
      ok(`the browser-rendered note ${id} page is rendered`, note.includes("<p>About</p>"));
      ok(`the browser-rendered note ${id} page marks itself prerendered`, note.includes(PRERENDER_SCRIPT));
    }

    const shell = readFileSync(join(dir, "404.html"), "utf8");
    ok("404.html is not rendered by the browser renderer", !shell.includes("<p>Home</p>"));
    ok("404.html is not marked prerendered", !shell.includes(PRERENDER_SCRIPT));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
