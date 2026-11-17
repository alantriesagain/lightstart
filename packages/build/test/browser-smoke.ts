/**
 * @file Build the tasks-web example into a temp folder, serve it through `@lightstart/server`, and
 * check in Chromium that its root view rendered the first route with the default list open and the
 * console stayed clean. The app's `.light/` is generated first, as `light build` does. Run with
 * `node packages/build/test/browser-smoke.ts`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { App } from "@lightstart/server";
import { Static } from "@lightstart/server/static";
import { serve } from "@lightstart/server/node";
import { build } from "../build.ts";

/** Generate the app's `.light/` in `root`, as `light build` does first: `light app`, from this checkout's CLI. */
const generate = (root: string): void => {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url)), "app"], { cwd: root, stdio: "ignore" });
};

const main = async (): Promise<void> => {
  const root = fileURLToPath(new URL("../../../examples/tasks-web", import.meta.url));
  const out = mkdtempSync(join(tmpdir(), "light-build-smoke-"));
  let server: Awaited<ReturnType<typeof serve>> | null = null;
  try {
    generate(root);
    const report = await build({ root, outDir: out });
    const app = new App().plugin(new Static({ root: join(out, "builds", report.id) }));
    server = await serve(app, { port: 0 });
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/`);
    await page.waitForSelector("app-root tasks-page input[name=task]", { timeout: 15000 });
    const header = ((await page.textContent("app-root header")) ?? "").replace(/\s+/g, " ").trim();
    const placeholder = await page.getAttribute("app-root tasks-page input[name=task]", "placeholder");
    const rendered = header.includes("Tasks") && header.includes("Inbox") && placeholder === "A task";
    console.log(`app-root rendered: ${rendered}`);
    console.log(`console errors: ${errors.length}`);
    for (const error of errors) console.log(`  ${error}`);
    if (!rendered || errors.length > 0) process.exitCode = 1;
    await page.close();
    await browser.close();
  } finally {
    if (server !== null) await server.close();
    rmSync(out, { recursive: true, force: true });
  }
};

await main();
