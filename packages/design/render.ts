/**
 * @file Rendering a canvas's boards to PNG: each board at its own width and height in headless
 * Chromium, into `design/renders/<canvas>/`. Playwright is the project's, else the one beside
 * light, found the way the build's prerender finds it.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { canvasDir, readCanvasIndex } from "./canvas.ts";
import type { CanvasIndex, RenderPlan, RenderTarget } from "./types.ts";

interface RenderPage {
  goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(options: { path: string }): Promise<unknown>;
  close(): Promise<void>;
}

interface RenderBrowser {
  newPage(options?: { viewport?: { width: number; height: number } }): Promise<RenderPage>;
  close(): Promise<void>;
}

interface Chromium {
  launch(options?: { headless?: boolean }): Promise<RenderBrowser>;
}

const isChromium = (value: unknown): value is Chromium => typeof value === "object" && value !== null && typeof (value as { launch?: unknown }).launch === "function";

/**
 * Playwright's Chromium from the project, else from beside light; fails naming what to install.
 *
 * @param root The project folder.
 * @returns The Chromium launcher.
 */
export const chromiumFrom = async (root: string): Promise<Chromium> => {
  const bases: string[] = [join(root, "package.json")];
  try {
    bases.push(createRequire(import.meta.url).resolve("@lightstart/light"));
  } catch {
    // light is not resolvable from here; the project may still have Playwright.
  }
  for (const base of bases) {
    try {
      const resolved = createRequire(base).resolve("playwright");
      const module = (await import(pathToFileURL(resolved).href)) as { chromium?: unknown; default?: { chromium?: unknown } };
      const chromium = module.chromium ?? module.default?.chromium;
      if (isChromium(chromium)) return chromium;
    } catch {
      // Try the next base.
    }
  }
  throw new Error("Rendering needs Playwright. Install it with `pnpm add -D playwright` and `npx playwright install chromium`.");
};

/**
 * The boards a render writes, selected by name or file, and where each PNG goes.
 *
 * @param projectDir The project folder.
 * @param canvas The canvas name.
 * @param index The canvas index.
 * @param only Board names (without `.dc.html`) or files; every board when empty.
 * @param base The index's base prefix, for a canvas staged under `canvas/project`.
 * @returns The boards and the output folder.
 */
export const planRenders = (projectDir: string, canvas: string, index: CanvasIndex, only: readonly string[] = [], base = ""): RenderPlan => {
  const dir = join(projectDir, "design", "renders", canvas);
  const folder = join(projectDir, "design", canvas, ...(base ? base.split("/").filter(Boolean) : []));
  const boards: RenderTarget[] = Object.entries(index.boards)
    .map(([file, board]) => {
      const name = file.replace(".dc.html", "");
      return { file, name, source: join(folder, file), path: join(dir, `${name}.png`), width: board.w, height: board.h };
    })
    .filter((board) => only.length === 0 || only.includes(board.name) || only.includes(board.file));
  return { projectDir, canvas, dir, boards };
};

/**
 * Render every planned board to its PNG, then answer the plan it wrote.
 *
 * @param plan The boards and output folder.
 * @returns The plan, once every board is written.
 */
export const renderPlan = async (plan: RenderPlan): Promise<RenderPlan> => {
  if (plan.boards.length === 0) return plan;
  mkdirSync(plan.dir, { recursive: true });
  const chromium = await chromiumFrom(plan.projectDir);
  const browser = await chromium.launch();
  try {
    for (const board of plan.boards) {
      const page = await browser.newPage({ viewport: { width: board.width, height: board.height } });
      try {
        await page.goto(pathToFileURL(board.source).href, { waitUntil: "load" });
        await page.waitForTimeout(100);
        await page.screenshot({ path: board.path });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return plan;
};

/**
 * Render a canvas's boards, or the ones named, to `design/renders/<canvas>/`.
 *
 * @param projectDir The project folder.
 * @param canvas The canvas name.
 * @param only Board names (without `.dc.html`) or files; every board when empty.
 * @returns The plan that was written.
 */
export const renderCanvas = async (projectDir: string, canvas: string, only: readonly string[] = []): Promise<RenderPlan> => {
  const source = readCanvasIndex(canvasDir(projectDir, canvas));
  if (!source) throw new Error(`design/${canvas} has no canvas.json; run light design:build ${canvas}`);
  return await renderPlan(planRenders(projectDir, canvas, source.index, only, source.base));
};
