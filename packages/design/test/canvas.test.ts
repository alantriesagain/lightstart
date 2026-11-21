// node-only
/**
 * @file The design canvas build: which folders under `design/` are canvases, the index at the
 * canvas root and under `canvas/project`, the preview it writes, and the refusal of a canvas with
 * no index.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import { buildCanvas, canvasInfo, canvasNames, readCanvasIndex, writePreview } from "../canvas.ts";
import type { CanvasIndex } from "../types.ts";

const INDEX: CanvasIndex = {
  title: "Demo",
  boards: { "Home.dc.html": { x: 0, y: 0, w: 390, h: 844, title: "Home" } },
  notes: { band: { x: 0, y: 0, text: "THE BAND", kind: "title1", maxW: 600 } },
};

const temp = (): string => mkdtempSync(join(tmpdir(), "light-design-"));

const canvas = (root: string, name: string, relativeIndex: string): string => {
  const dir = join(root, "design", name);
  mkdirSync(join(dir, "canvas", "project"), { recursive: true });
  writeFileSync(join(dir, "directions.mjs"), "export default {};\n");
  writeFileSync(
    join(dir, "build.mjs"),
    `import { mkdirSync, writeFileSync } from "node:fs";\nmkdirSync("canvas/project", { recursive: true });\nwriteFileSync(${JSON.stringify(relativeIndex)}, ${JSON.stringify(`${JSON.stringify(INDEX, null, 2)}\n`)});\nwriteFileSync("Home.dc.html", "<x-dc></x-dc>");\n`,
  );
  return dir;
};

const root = temp();
try {
  canvas(root, "mobile", "canvas.json");
  mkdirSync(join(root, "design", "notes"));
  writeFileSync(join(root, "design", "notes", "README.md"), "");
  eq("the folders with a build.mjs are the canvases", JSON.stringify(canvasNames(root)), '["mobile"]');
  eq("a canvas with no index is not built", JSON.stringify(canvasInfo(root)), '[{"name":"mobile","boards":0,"built":false}]');

  const mobile = canvas(root, "mobile", "canvas.json");
  const admin = canvas(root, "admin", "canvas/project/canvas.json");
  const built = buildCanvas(mobile);
  eq("the canvas builds", String(built.ok), "true");
  eq("the build reports its boards", String(built.boards), "1");
  eq("an index at the canvas root has no base", readCanvasIndex(mobile)?.base ?? "missing", "");
  buildCanvas(admin);
  eq("an index under canvas/project has its base", readCanvasIndex(admin)?.base ?? "missing", "canvas/project/");

  buildCanvas(admin);
  const written = writePreview(admin);
  eq("the preview counts its boards", String(written.boards), "1");
  ok("the preview points at the staged boards", readFileSync(join(admin, "preview.html"), "utf8").includes('<iframe src="canvas/project/Home.dc.html"'));

  const empty = join(root, "design", "empty");
  mkdirSync(empty, { recursive: true });
  writeFileSync(join(empty, "build.mjs"), "");
  throws("a canvas with no index is refused", () => writePreview(empty), "no canvas.json");
} finally {
  rmSync(root, { recursive: true, force: true });
}
done();
