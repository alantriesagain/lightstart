// node-only
/**
 * @file The PWA fixture built and opened as a static host serves it: the
 * first load registers the worker, a reload leaves the page controlled, an
 * offline reload draws the shell and a page visited earlier, and a rebuilt
 * app reaches a waiting worker the page applies.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";
import { latestBuild, openBuilt } from "@lightstart/app/web/test";
import type { OpenedBuiltPage } from "@lightstart/app/web/test";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

interface PwaGlobal {
  __pwa?: {
    update: { value: { waiting: boolean } };
    apply(): Promise<void>;
    check(): Promise<void>;
  };
}

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-pwa-built-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const build = (project: string): void => {
  const run = spawnSync(process.execPath, ["--no-warnings", cli, "build"], {
    cwd: project,
    env: { ...process.env, LIGHT_PROJECT_DIR: project, NO_COLOR: "1" },
    encoding: "utf8",
  });
  eqn("light build exits 0", run.status ?? 1, 0);
  if ((run.status ?? 1) !== 0) console.log(run.stdout, run.stderr);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (page: OpenedBuiltPage, check: () => boolean | Promise<boolean>, label: string): Promise<void> => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // The page is reloading; try again once it has one.
    }
    await sleep(50);
  }
  throw new Error(`the page never ${label}: ${await page.text().catch(() => "(reloading)")}`);
};

const controlled = (page: OpenedBuiltPage): Promise<boolean> =>
  page.evaluate(() => navigator.serviceWorker.controller !== null);

const main = async (): Promise<void> => {
  const project = copy();
  build(project);
  const dir = await latestBuild(project);
  try {
    const first = await openBuilt(dir, "/");
    try {
      ok("the first load registers the worker", await first.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration !== undefined)));
      ok("the first load draws the app", (await first.text()).includes("Home"));
      await first.reload();
      await waitFor(first, () => controlled(first), "took control after a reload");
      ok("a reload leaves the page controlled", await controlled(first));

      await first.click('a[href="/about"]');
      ok("the about page draws", (await first.shows("About")).includes("About"));
      await first.click('a[href="/"]');
      await first.shows("Home");

      await first.offline(true);
      await first.reload();
      ok("an offline reload still draws the app", (await first.shows("Home")).includes("Home"));
      await first.click('a[href="/about"]');
      await first.shows("About");
      await first.reload();
      ok("a page visited before going offline draws again", (await first.shows("About")).includes("About"));
      await first.offline(false);
    } finally {
      await first.close();
    }

    const update = await openBuilt(dir, "/");
    try {
      await update.reload();
      await waitFor(update, () => controlled(update), "took control after a reload");

      writeFileSync(
        join(project, "src", "views", "app-home.js"),
        'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\nimport { pwa } from "@lightstart/pwa/page";\n\nglobalThis.__pwa = pwa;\n\nclass AppHome extends View {\n  render() {\n    return html`<h1>Home updated</h1><a href="/about">About</a>`;\n  }\n}\n\nView.register("app-home", AppHome);\n',
      );
      build(project);

      await update.evaluate(() => (window as unknown as PwaGlobal).__pwa?.check());
      await waitFor(update, () => update.evaluate(() => Boolean((window as unknown as PwaGlobal).__pwa?.update.value.waiting)), "had a waiting worker");
      ok("a rebuilt app leaves a worker waiting", await update.evaluate(() => Boolean((window as unknown as PwaGlobal).__pwa?.update.value.waiting)));

      await update.evaluate(() => (window as unknown as PwaGlobal).__pwa?.apply()).catch(() => undefined);
      await waitFor(update, async () => (await update.text()).includes("Home updated"), "showed the new content");
      ok("the applied update reloads onto the new content", (await update.text()).includes("Home updated"));
    } finally {
      await update.close();
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
