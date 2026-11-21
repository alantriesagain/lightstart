/**
 * @file A project's design canvases: which folders under `design/` are canvases, the index a build
 * wrote, the local preview written from it, running the canvas's `build.mjs`, and what a listing
 * shows.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { previewPage } from "./preview.ts";
import type { BuildResult, CanvasIndex, CanvasInfo, CanvasSource } from "./types.ts";

const DESIGN = "design";
const BUILD = "build.mjs";
const PREVIEW = "preview.html";

const isCanvas = (dir: string): boolean => existsSync(join(dir, BUILD));

/**
 * The canvases under a project's `design/` folder, by name.
 *
 * @param projectDir The project folder.
 * @returns The canvas names, sorted.
 */
export const canvasNames = (projectDir: string): string[] => {
  const dir = join(projectDir, DESIGN);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isCanvas(join(dir, entry.name)))
    .map((entry) => entry.name)
    .sort();
};

/**
 * The folder of a canvas.
 *
 * @param projectDir The project folder.
 * @param name The canvas name.
 * @returns The canvas folder.
 */
export const canvasDir = (projectDir: string, name: string): string => join(projectDir, DESIGN, name);

/**
 * The index a build wrote, at the canvas root or under `canvas/project` for a build that only
 * stages the published tree.
 *
 * @param dir The canvas folder.
 * @returns The index and its base prefix, or null when the canvas has no index.
 */
export const readCanvasIndex = (dir: string): CanvasSource | null => {
  for (const candidate of [join(dir, "canvas.json"), join(dir, "canvas", "project", "canvas.json")]) {
    if (!existsSync(candidate)) continue;
    const index = JSON.parse(readFileSync(candidate, "utf8")) as CanvasIndex;
    const base = relative(dir, dirname(candidate)).split(sep).join("/");
    return { file: candidate, base: base ? `${base}/` : "", index };
  }
  return null;
};

/**
 * Write `preview.html` from the index a build wrote. The preview is generated; never edit it by hand.
 *
 * @param dir The canvas folder.
 * @returns The preview file and how many boards it draws.
 */
export const writePreview = (dir: string): { file: string; boards: number } => {
  const source = readCanvasIndex(dir);
  if (!source) throw new Error(`no canvas.json under ${dir}; build the canvas first`);
  const file = join(dir, PREVIEW);
  writeFileSync(file, previewPage(source.index, { base: source.base }));
  return { file, boards: Object.keys(source.index.boards).length };
};

/**
 * Run the canvas's `build.mjs`, then write the local preview.
 *
 * @param dir The canvas folder.
 * @returns Whether it built, its exit status, and the preview it wrote.
 */
export const buildCanvas = (dir: string): BuildResult => {
  if (!existsSync(join(dir, BUILD))) return { ok: false, status: 1 };
  const result = spawnSync(process.execPath, [BUILD], { cwd: dir, stdio: "inherit" });
  const status = result.status ?? 1;
  if (status !== 0) return { ok: false, status };
  const preview = writePreview(dir);
  return { ok: true, status: 0, preview: preview.file, boards: preview.boards };
};

/**
 * What a listing shows for each canvas.
 *
 * @param projectDir The project folder.
 * @returns One record per canvas.
 */
export const canvasInfo = (projectDir: string): CanvasInfo[] =>
  canvasNames(projectDir).map((name) => {
    const source = readCanvasIndex(canvasDir(projectDir, name));
    return { name, boards: source ? Object.keys(source.index.boards).length : 0, built: Boolean(source) };
  });
