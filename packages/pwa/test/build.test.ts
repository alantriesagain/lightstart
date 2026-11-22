// node-only
/**
 * @file A `light build` of the PWA fixture: the manifest and the worker are
 * written, `_headers` keeps them out of caches, and both the page and
 * `404.html` carry the manifest link and theme colour, with no registration
 * script of their own. A based build puts the base before every one of those
 * paths.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const copy = (url?: string): string => {
  const project = mkdtempSync(join(tmpdir(), "light-pwa-build-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  if (url !== undefined) writeFileSync(join(project, "src", "app.js"), `import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "pwa-fixture", title: "PWA Fixture", host: "web", url: ${JSON.stringify(url)} });\n`);
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

const readBuild = (project: string, path: string): string => readFileSync(join(project, ".deployed", "current", path), "utf8");

const check = (project: string, base: string, label: string): void => {
  const manifest = JSON.parse(readBuild(project, "manifest.webmanifest")) as Record<string, unknown>;
  const prefix = base === "" ? "" : base;
  eq(`${label}: the manifest name comes from the app's title`, String(manifest["name"]), "PWA Fixture");
  eq(`${label}: the short name comes from the app's config`, String(manifest["short_name"]), "PWA");
  eq(`${label}: the description is kept`, String(manifest["description"]), "A PWA fixture");
  eq(`${label}: the display defaults to standalone`, String(manifest["display"]), "standalone");
  eq(`${label}: the start url is the base`, String(manifest["start_url"]), prefix === "" ? "/" : prefix);
  eq(`${label}: the scope is the base`, String(manifest["scope"]), prefix === "" ? "/" : prefix);
  eq(`${label}: an icon takes the base`, String((manifest["icons"] as { src?: string }[])[0]?.src), `${prefix}/icon.svg`);

  const worker = readBuild(project, "sw.js");
  ok(`${label}: the worker names the manifest`, worker.includes(JSON.stringify(`${prefix}/manifest.webmanifest`)));
  ok(`${label}: the worker precaches the page`, worker.includes(JSON.stringify(`${prefix}/index.html`)));
  ok(`${label}: the worker carries a versioned cache`, worker.includes("pwa-") && /[0-9a-f]{8}/.test(worker));
  ok(`${label}: the worker does not precache itself`, !worker.includes(JSON.stringify(`${prefix}/sw.js`)));

  const headers = readBuild(project, "_headers");
  ok(`${label}: the worker is not cached`, headers.includes(`${prefix}/sw.js\n  Cache-Control: no-cache`));
  ok(`${label}: the manifest is not cached`, headers.includes(`${prefix}/manifest.webmanifest\n  Cache-Control: no-cache`));

  for (const page of ["index.html", "404.html"]) {
    const html = readBuild(project, page);
    ok(`${label}: ${page} links the manifest`, html.includes(`<link rel="manifest" href="${prefix}/manifest.webmanifest">`));
    ok(`${label}: ${page} carries the theme colour`, html.includes('<meta name="theme-color" content="#123456">'));
    ok(`${label}: ${page} carries no registration script`, !html.includes("serviceWorker.register"));
  }
};

const main = (): void => {
  const plain = copy();
  try {
    build(plain);
    check(plain, "", "root");
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }

  const based = copy("https://x.example/app");
  try {
    build(based);
    check(based, "/app", "based");
    const worker = readBuild(based, "sw.js");
    ok("based: no path escapes the base", !worker.includes('"/index.html"') && !worker.includes('"/app/app/'));
  } finally {
    rmSync(based, { recursive: true, force: true });
  }
  done();
};

main();
