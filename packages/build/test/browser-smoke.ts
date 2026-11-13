/**
 * @file Build todomvc into a temp folder, serve it through `@lightstart/server`, and check in
 * Chromium that `<todo-app>` rendered and the console stayed clean. Run with
 * `node packages/build/test/browser-smoke.ts`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { App } from "@lightstart/server";
import { Static } from "@lightstart/server/static";
import { serve } from "@lightstart/server/node";
import { build } from "../build.ts";

const main = async (): Promise<void> => {
  const root = fileURLToPath(new URL("../../../examples/todomvc", import.meta.url));
  const out = mkdtempSync(join(tmpdir(), "light-build-smoke-"));
  let server: Awaited<ReturnType<typeof serve>> | null = null;
  try {
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
    await page.waitForSelector("todo-app .todoapp", { timeout: 15000 });
    const heading = ((await page.textContent("todo-app .todoapp h1")) ?? "").trim();
    const placeholder = await page.getAttribute("todo-app .todoapp .new-todo", "placeholder");
    const rendered = heading === "todos" && placeholder === "What needs to be done?";
    console.log(`todo-app rendered: ${rendered}`);
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
