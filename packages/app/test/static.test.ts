// node-only
/**
 * @file Rendering a web app's page in node: `renderApp` mounts the fixture's
 * root view on the markup host at a path, its routed view and route parameters
 * drawn, and `renderPage` puts that markup into the built page with the
 * prerender marker. The views registered only because the markup host was
 * imported before the generated manifest.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "@lightstart/light/markup";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { generate } from "../node/generate.ts";
import { renderApp, renderPage } from "../static/index.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-static-render-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    await generate(project);
    const manifest = (await import(pathToFileURL(join(project, ".light", "app.ts")).href)) as { default: AppManifest };
    const app = manifest.default;

    const home = await renderApp(app);
    ok("the root view renders at /", home.includes("<h1>Notes</h1>"));
    ok("the home view renders at /", home.includes("<p>Home</p>"));
    ok("the markup carries the engine's markers", home.includes("<!--$r-->"));

    const about = await renderApp(app, { path: "/about" });
    ok("the about view renders at /about", about.includes("<p>About</p>") && !about.includes("<p>Home</p>"));

    const note = await renderApp(app, { path: "/notes/7" });
    ok("a route parameter reaches the view as a prop", note.includes('class="id"') && note.includes("<!--$-->7<!--/-->"));

    const page = readFileSync(join(fixture, "index.html"), "utf8");
    const rendered = await renderPage(app, page, { path: "/about" });
    ok("the page holds the rendered root view", rendered.includes("<p>About</p>") && rendered.includes("<h1>Notes</h1>"));
    ok("the page's placeholder is gone", !rendered.includes("<app-root></app-root>"));
    ok("the prerender marker comes first in head", /<head[^>]*><script>window\.__PRERENDERED__ = true<\/script>/i.test(rendered));

    let message = "";
    try {
      await renderApp({ ...app, app: defineApp({ name: "fixture-web", host: "web", root: "missing-root" }) });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    ok("an unregistered root view is a clear error", message.includes('The root view "<missing-root>" is not registered on the markup host'));

    eq("the rendered page is still a string", typeof rendered, "string");
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
