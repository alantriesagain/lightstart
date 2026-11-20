// node-only
/**
 * @file A built web app opened the way a static host serves it: `/` boots,
 * a path answered by `404.html` boots, and a copy with a built chunk removed
 * reports the failed request.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { generate as generateProject } from "../node/generate.ts";
import { latestBuild, openBuilt } from "../web/test.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));
const typed = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-web-built-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(typed, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const builtChunkOf = (dir: string): string => {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const found = /(?:src|href)="([^"]+\.js)"/.exec(html);
  if (found?.[1] === undefined) throw new Error("the built page names no script");
  return found[1].replace(/^\/+/, "");
};

const main = async (): Promise<void> => {
  const project = copy();
  const broken = mkdtempSync(join(tmpdir(), "light-app-web-broken-"));
  try {
    const generated = await generateProject(project);
    ok("the fixture generates", generated !== null);
    if (generated === null) return done();

    const api = createBuildExtension({ root: project, minify: false });
    await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
    const report = await build({ root: project, minify: false }, api);
    ok("the fixture builds", report.files.length > 0);

    const newest = await latestBuild(project);
    ok("latestBuild names the build current points at", newest.endsWith(join(".deployed", "current")));

    const home = await openBuilt(report.dir, "/");
    try {
      ok("the built home page boots without an error", home.errors.length === 0 && home.failed.length === 0);
      ok("the built home page draws the app", (await home.text()).includes("Seeded note"));
    } finally {
      await home.close();
    }

    const walk = await openBuilt(report.dir, "/");
    try {
      await walk.evaluate(() => window.scrollTo(0, 600));
      await walk.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await walk.evaluate(() => {
        const link = document.querySelector('a[href="/about"]');
        if (link instanceof HTMLElement) link.click();
      });
      ok("a link goes to the other route", (await walk.shows("About these notes")).includes("About these notes") && (await walk.path()) === "/about");
      ok("the about page has its own title", (await walk.evaluate(() => document.title)) === "About · Fixture Web");
      await walk.back();
      ok("the browser's back draws the previous route", (await walk.shows("Seeded note")).includes("Seeded note") && (await walk.path()) === "/");
      ok("the home page restores the scroll position it had", (await walk.evaluate(() => window.scrollY)) === 600);
      ok("the home page is titled with the app alone", (await walk.evaluate(() => document.title)) === "Fixture Web");
      await walk.forward();
      ok("the browser's forward draws the next one again", (await walk.shows("About these notes")).includes("About these notes"));
      ok("walking the history raises no error", walk.errors.length === 0 && walk.failed.length === 0);
    } finally {
      await walk.close();
    }

    const fallback = await openBuilt(report.dir, "/no-such-route");
    try {
      ok("the 404.html fallback boots without an error", fallback.errors.length === 0 && fallback.failed.length === 0);
    } finally {
      await fallback.close();
    }

    cpSync(report.dir, broken, { recursive: true });
    const chunk = builtChunkOf(broken);
    rmSync(join(broken, chunk));
    const missing = await openBuilt(broken, "/");
    try {
      ok("a missing built chunk is a failed request", missing.failed.some((entry) => entry.includes(basename(chunk))));
    } finally {
      await missing.close();
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(broken, { recursive: true, force: true });
  }
  done();
};

await main();
