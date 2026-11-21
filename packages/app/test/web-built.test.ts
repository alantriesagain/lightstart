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

    const entry = builtChunkOf(report.dir);
    const entrySource = readFileSync(join(report.dir, entry), "utf8");
    ok("the page's entry bundle carries no IndexedDB adapter", !entrySource.includes("_expectedStores"));
    ok("the page's entry bundle carries no unused Markdown grammar", !entrySource.includes("setext"));
    const chunks = report.files.filter((file) => file.path.endsWith(".js") && file.path.replace(/^\/+/, "") !== entry);
    const chunkSource = (chunk: (typeof chunks)[number]): string => readFileSync(join(report.dir, chunk.path), "utf8");
    ok("the JavaScript grammar arrives as its own chunk", chunks.some((chunk) => chunkSource(chunk).includes("TS_KEYWORDS")));
    ok("the Markdown grammar arrives as its own chunk", chunks.some((chunk) => chunkSource(chunk).includes("setext")));

    const home = await openBuilt(report.dir, "/");
    try {
      ok("the built home page boots without an error", home.errors.length === 0 && home.failed.length === 0);
      ok("the built home page draws the app", (await home.text()).includes("Seeded note"));
      const coloured = await home.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            let left = 100;
            const look = (): void => {
              if (document.querySelector("lc-code-block .tok-keyword") !== null || left-- <= 0) resolve(left > 0);
              else setTimeout(look, 20);
            };
            look();
          }),
      );
      ok("the code block loads its grammar on demand and colours the snippet", coloured);
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
      const restored = await walk.evaluate(() => new Promise<number>((resolve) => {
        let left = 200;
        const check = (): void => {
          if (window.scrollY === 600 || left-- <= 0) resolve(window.scrollY);
          else setTimeout(check, 10);
        };
        check();
      }));
      ok("the home page restores the scroll position it had", restored === 600);
      ok("the home page is titled with the app alone", (await walk.evaluate(() => document.title)) === "Fixture Web");
      await walk.forward();
      ok("the browser's forward draws the next one again", (await walk.shows("About these notes")).includes("About these notes"));
      ok("walking the history raises no error", walk.errors.length === 0 && walk.failed.length === 0);
    } finally {
      await walk.close();
    }

    const morph = await openBuilt(report.dir, "/");
    try {
      await morph.evaluate(() => {
        const w = window as unknown as { __morphRuns?: { before: string[]; after: string[] }[] };
        const labels = (): string[] => {
          const out: string[] = [];
          for (const element of document.querySelectorAll("body *")) {
            if (!(element instanceof HTMLElement) || element.style.viewTransitionName !== "morph") continue;
            if (element.matches('nav a[href="/about"]')) out.push("nav-link");
            else if (element.matches("app-about [data-morph]")) out.push("about-morph");
            else out.push(element.tagName.toLowerCase());
          }
          return out;
        };
        const runs: { before: string[]; after: string[] }[] = [];
        w.__morphRuns = runs;
        const doc = document as unknown as { startViewTransition?: (callback: () => Promise<void> | void) => { finished: Promise<void> } };
        doc.startViewTransition = (callback) => {
          const before = labels();
          let finish: () => void = () => {};
          const finished = new Promise<void>((resolve) => {
            finish = resolve;
          });
          Promise.resolve(callback()).then(() => {
            runs.push({ before, after: labels() });
            finish();
          });
          return { finished };
        };
      });
      await morph.click('nav a[href="/about"]');
      await morph.shows("About these notes");
      await morph.evaluate(() => new Promise<void>((resolve) => {
        const check = (): void => {
          const runs = (window as unknown as { __morphRuns?: unknown[] }).__morphRuns ?? [];
          if (runs.length >= 1) resolve();
          else setTimeout(check, 10);
        };
        check();
      }));
      const forward = await morph.evaluate(() => (window as unknown as { __morphRuns: { before: string[]; after: string[] }[] }).__morphRuns);
      ok("a forward morph names the clicked link before and the about element after", forward.length === 1 && forward[0]?.before.join() === "nav-link" && forward[0]?.after.join() === "about-morph");
      ok("the names are clear once the forward morph settles", (await morph.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => element instanceof HTMLElement && element.style.viewTransitionName === "morph").length)) === 0);
      await morph.back();
      await morph.shows("Seeded note");
      await morph.evaluate(() => new Promise<void>((resolve) => {
        const check = (): void => {
          const runs = (window as unknown as { __morphRuns?: unknown[] }).__morphRuns ?? [];
          if (runs.length >= 2) resolve();
          else setTimeout(check, 10);
        };
        check();
      }));
      const back = await morph.evaluate(() => (window as unknown as { __morphRuns: { before: string[]; after: string[] }[] }).__morphRuns);
      ok("a back navigation morphs the about element into the home page's link", back.length === 2 && back[1]?.before.join() === "about-morph" && back[1]?.after.join() === "nav-link");
      ok("the names are clear once the back morph settles", (await morph.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => element instanceof HTMLElement && element.style.viewTransitionName === "morph").length)) === 0);
    } finally {
      await morph.close();
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
