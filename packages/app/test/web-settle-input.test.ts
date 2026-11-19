// node-only
/**
 * @file A prerendered page ends its settle wait at the user's first input,
 * before the work its views handed over is done: typing in a search box shows
 * the filtered list at once, while a page nobody touches keeps the served list
 * until that work ends.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";
import { chromiumFrom } from "../node/prerender.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const project = mkdtempSync(join(tmpdir(), "light-app-settle-input-"));
cpSync(fixture, project, { recursive: true, filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed") });
symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
const pagePath = join(project, "index.html");
writeFileSync(pagePath, readFileSync(pagePath, "utf8").replace("./.light/main.ts", "/.light/main.ts"));

const sleep = (ms: number): Promise<void> => new Promise((settle) => setTimeout(settle, ms));

const waitForText = async (read: () => Promise<string>, wanted: string, timeout: number): Promise<number> => {
  const start = Date.now();
  while (Date.now() - start <= timeout) {
    if ((await read()) === wanted) return Date.now() - start;
    await sleep(20);
  }
  throw new Error(`the list showed "${await read()}" instead of "${wanted}" within ${String(timeout)} ms`);
};

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
  const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/search`;
  const browser = await (await chromiumFrom(project)).launch();
  try {
    const untouched = await browser.newPage();
    const listText = (page: typeof untouched): Promise<string> =>
      page.evaluate(() => Array.from(document.querySelectorAll("app-search li")).map((item) => item.textContent).join(","));
    await untouched.addInitScript(`document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("app-search li").forEach((item) => item.setAttribute("data-served", "1")));`);
    await untouched.goto(url, { waitUntil: "networkidle" });
    await sleep(800);
    const kept = await untouched.evaluate(() => Array.from(document.querySelectorAll("app-search li")).every((item) => item.getAttribute("data-served") === "1"));
    ok("without input the served list is kept while the work is pending", kept);
    const served = await listText(untouched);
    ok("the served list has every item", served === "alpha,alphabet,beta,gamma");

    const typed = await browser.newPage();
    await typed.goto(url, { waitUntil: "networkidle" });
    await typed.evaluate(() => {
      const input = document.querySelector("app-search input.search");
      if (!(input instanceof HTMLInputElement)) throw new Error("the search input is not there");
      input.value = "gam";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const elapsed = await waitForText(() => listText(typed), "gamma", 1000);
    eq("the filtered list shows at once after the input", await listText(typed), "gamma");
    ok("and well before the work ends", elapsed < 1000);
  } finally {
    await browser.close();
    server.close();
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
