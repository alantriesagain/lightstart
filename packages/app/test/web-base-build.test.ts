// node-only
/**
 * @file A build of a based app: the output folder is deployed at the base, so
 * every root-relative URL in its page carries it, and `404.html`, the sitemap,
 * `robots.txt`, `_headers` and a prerendered page follow.
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { openBuilt } from "../web/test.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-base", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-base-build-"));
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
    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
    const report = await build({ root: project, minify: false }, api);
    const dir = report.dir;
    const html = readFileSync(join(dir, "index.html"), "utf8");
    const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((match) => match[1]!);
    ok("the bundle URL carries the base", scripts.length === 1 && scripts[0]!.startsWith("/budget/"));
    ok("the bundle exists at the path without the base", existsSync(join(dir, scripts[0]!.slice("/budget/".length))));
    const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]!);
    ok("the stylesheet URL carries the base", styles.length === 1 && styles[0]!.startsWith("/budget/"));
    ok("the favicon carries the base", html.includes('href="/budget/favicon.svg"'));
    ok("a prerendered link carries the base", html.includes('href="/budget/about"'));
    ok("the prerendered home page puts the base before its external link too", html.includes('href="/budget/docs"'));

    const notFound = readFileSync(join(dir, "404.html"), "utf8");
    ok("404.html carries the base too", notFound.includes('src="/budget/module-0-'));
    ok("404.html is the unrendered shell", !notFound.includes("<p>Home</p>"));

    const about = readFileSync(join(dir, "about", "index.html"), "utf8");
    ok("a prerendered page's link carries the base", about.includes('href="/budget/"'));
    ok("its canonical is the address plus the app path", about.includes('rel="canonical" href="https://user.github.io/budget/about"'));

    const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
    ok("the sitemap is the address plus the app path", sitemap.includes("<loc>https://user.github.io/budget/</loc>") && sitemap.includes("<loc>https://user.github.io/budget/about</loc>"));
    ok("the sitemap has no double base", !sitemap.includes("/budget/budget"));
    eq("robots.txt names the sitemap under the base", readFileSync(join(dir, "robots.txt"), "utf8"), "User-agent: *\nAllow: /\nSitemap: https://user.github.io/budget/sitemap.xml\n");
    const headers = readFileSync(join(dir, "_headers"), "utf8");
    ok("the no-cache patterns are under the base", headers.includes("/budget/index.html") && headers.includes("/budget/404.html") && headers.includes("/budget/\n"));
    ok("the hashed assets are cached under the base", /\/budget\/module-0-[^.\n]+\.js\n  Cache-Control: public/.test(headers));

    const current = join(project, ".deployed", "current");
    const page = await openBuilt(current, "/about");
    try {
      ok("the based build boots without an error", page.errors.length === 0 && page.failed.length === 0);
      ok("it draws the route at its based path", (await page.text()).includes("About") && (await page.path()) === "/budget/about");
    } finally {
      await page.close();
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
