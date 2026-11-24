// node-only
/**
 * @file A localized app rendered and built: a `/pt` page is titled by its
 * route's `t()` title, carries an alternate link per language plus `x-default`
 * and its `og:locale`, writes `pageHead`'s JSON-LD, and the sitemap lists each
 * language's concrete paths with their alternates.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "@lightstart/light/markup";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import type { AppManifest } from "../manifest.ts";
import appBuild from "../cli/extend/build.ts";
import { generate } from "../node/generate.ts";
import { renderPage } from "../static/index.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-locale", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-locale-"));
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
    const module = (await import(pathToFileURL(join(project, ".light", "app.js")).href)) as { default: AppManifest };
    const manifest = module.default;
    const page = readFileSync(join(project, "index.html"), "utf8");

    const rendered = await renderPage(manifest, page, { path: "/pt/about" });
    ok("the Portuguese route title comes from its t() function", rendered.includes("<title>Sobre · Fixture Locale</title>"));
    ok("the page carries its language", rendered.includes('property="og:locale" content="pt"'));
    ok("the page links every language", ["en", "pt", "es", "x-default"].every((language) => rendered.includes(`hreflang="${language}"`)));
    ok("an alternate is the same route path in that language", rendered.includes('hreflang="es" href="https://fixture.example/es/about"'));
    ok("x-default is the default language's address", rendered.includes('hreflang="x-default" href="https://fixture.example/about"'));
    ok("the canonical stays the current page", rendered.includes('rel="canonical" href="https://fixture.example/pt/about"'));
    ok("pageHead writes its JSON-LD", rendered.includes('application/ld+json') && rendered.includes('"@type":"AboutPage"'));
    ok("the Portuguese words are rendered", rendered.includes("Sobre o fixture"));

    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
    const report = await build({ root: project, minify: false }, api);
    const sitemap = readFileSync(join(report.dir, "sitemap.xml"), "utf8");
    ok("the sitemap declares the xhtml namespace", sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
    ok("the sitemap lists each language's page", sitemap.includes("<loc>https://fixture.example/pt/about</loc>") && sitemap.includes("<loc>https://fixture.example/es/about</loc>"));
    ok("a page carries x-default and every alternate", sitemap.includes('hreflang="pt" href="https://fixture.example/pt/about"') && sitemap.includes('hreflang="x-default" href="https://fixture.example/about"'));
    eq("the built Portuguese page keeps its title", /<title>Sobre · Fixture Locale<\/title>/.exec(readFileSync(join(report.dir, "pt", "about", "index.html"), "utf8"))?.[0] ?? "", "<title>Sobre · Fixture Locale</title>");
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
