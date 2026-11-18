// node-only
/**
 * @file What a web build writes for a static host: the built page as
 * `404.html`, `sitemap.xml` over the routes without parameters,
 * `robots.txt`, and `_headers` caching the hashed outputs and the pages.
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-static-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const buildOf = async (project: string): Promise<string> => {
  const api = createBuildExtension({ root: project, minify: false });
  await appBuild.setup(undefined as never, undefined as never, api);
  const report = await build({ root: project, minify: false }, api);
  return report.dir;
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    writeFileSync(
      join(project, "src", "routes.ts"),
      'export default {\n  "/": { name: "home", title: "Home", view: "app-home" },\n  "/about": { name: "about", title: "About", view: "app-about" },\n  "/notes/:id": { name: "note", title: "Note", view: "app-about" },\n};\n',
    );
    const dir = await buildOf(project);
    const index = readFileSync(join(dir, "index.html"), "utf8");
    eq("404.html is the built page", readFileSync(join(dir, "404.html"), "utf8"), index);
    eq(
      "sitemap.xml lists the routes without parameters, sorted",
      readFileSync(join(dir, "sitemap.xml"), "utf8"),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://fixture.example/</loc>\n  </url>\n  <url>\n    <loc>https://fixture.example/about</loc>\n  </url>\n</urlset>\n',
    );
    eq("robots.txt names the sitemap", readFileSync(join(dir, "robots.txt"), "utf8"), "User-agent: *\nAllow: /\nSitemap: https://fixture.example/sitemap.xml\n");

    const headers = readFileSync(join(dir, "_headers"), "utf8");
    for (const path of ["/index.html", "/404.html", "/"]) ok(`${path} is not cached`, headers.includes(`${path}\n  Cache-Control: no-cache`));
    ok("a hashed module is cached forever", /^\/module-[A-Za-z0-9_-]+\.js\n  Cache-Control: public, max-age=31536000, immutable$/m.test(headers));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  const plain = copy();
  try {
    writeFileSync(join(plain, "src", "app.ts"), 'import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web", host: "web" });\n');
    const dir = await buildOf(plain);
    ok("without a url there is no sitemap", !existsSync(join(dir, "sitemap.xml")));
    eq("robots.txt has no sitemap line", readFileSync(join(dir, "robots.txt"), "utf8"), "User-agent: *\nAllow: /\n");
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
  done();
};

await main();
