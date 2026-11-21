// node-only
/**
 * @file A prerendered page boots without drawing again: built with
 * `--prerender --renderer markup` and served as a static host serves it, the page's served
 * elements (the root view, the container, the route's view and what it drew) are
 * the same nodes once the app has booted, the views adopting the served DOM.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { chromiumFrom } from "../node/prerender.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const project = mkdtempSync(join(tmpdir(), "light-app-adopt-"));
cpSync(fixture, project, { recursive: true, filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed") });
symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
const pagePath = join(project, "index.html");
writeFileSync(pagePath, readFileSync(pagePath, "utf8").replace("./.light/main.ts", "/.light/main.ts"));

const main = async (): Promise<void> => {
  const api = createBuildExtension({ root: project, minify: false });
  await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
  const dir = (await build({ root: project, minify: false }, api)).dir;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://x").pathname.replace(/^\/+/, "");
    for (const [file, status] of [[path === "" ? "index.html" : path, 200], [`${path}/index.html`, 200], ["404.html", 404]] as const) {
      try {
        const body = readFileSync(join(dir, file));
        response.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
        response.end(body);
        return;
      } catch {
        continue;
      }
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await (await chromiumFrom(project)).launch();
  try {
    const page = await browser.newPage();
    const marked = ["app-root", "app-container", "app-home", "app-home *"];
    await page.addInitScript(`const marked = ${JSON.stringify(marked)};
document.addEventListener("DOMContentLoaded", () => marked.forEach((s, i) => document.querySelector(s)?.setAttribute("data-served", String(i))));
globalThis.__kept = () => marked.map((s, i) => (document.querySelector(s)?.getAttribute("data-served") === String(i) ? "kept" : "drawn again")).join(", ");`);
    await page.goto(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 800)));
    const kept = await page.evaluate(() => (globalThis as { __kept?: () => string }).__kept?.() ?? "");
    eq("the served root, container, page and its content are kept through the boot", String(kept), marked.map(() => "kept").join(", "));

    const layoutPage = await browser.newPage();
    const layoutMarked = ["app-root", "app-shell-layout", "app-settings", "app-profile"];
    await layoutPage.addInitScript(`const marked = ${JSON.stringify(layoutMarked)};
document.addEventListener("DOMContentLoaded", () => marked.forEach((s, i) => document.querySelector(s)?.setAttribute("data-served", String(i))));
globalThis.__kept = () => marked.map((s, i) => (document.querySelector(s)?.getAttribute("data-served") === String(i) ? "kept" : "drawn again")).join(", ");`);
    await layoutPage.goto(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}/settings/profile`, { waitUntil: "networkidle" });
    await layoutPage.evaluate(() => new Promise((resolve) => setTimeout(resolve, 800)));
    const layoutKept = await layoutPage.evaluate(() => (globalThis as { __kept?: () => string }).__kept?.() ?? "");
    eq("a served layout and nested view are kept through the boot", String(layoutKept), layoutMarked.map(() => "kept").join(", "));
  } finally {
    await browser.close();
    server.close();
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
