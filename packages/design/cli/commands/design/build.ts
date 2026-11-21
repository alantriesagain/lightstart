/**
 * @file `light design:build [canvas]`: run one canvas's `build.mjs`, or every canvas's, and write
 * the local previews.
 */
import { existsSync } from "node:fs";
import { defineCommand } from "@lightstart/cli";
import { buildCanvas, canvasDir, canvasNames } from "../../../canvas.ts";

export default defineCommand({
  description: "Build one design canvas, or every canvas under design/",
  usage: "light design:build [canvas]",
  args: {
    canvas: { positional: true, description: "Canvas under design/ (default: every canvas)" },
  },
  run(ctx, { canvas }) {
    const names = canvas ? [canvas] : canvasNames(ctx.projectDir);
    if (!names.length) {
      ctx.log.error("no canvases under design/ (a canvas is a folder with a build.mjs)");
      return 1;
    }
    let status = 0;
    for (const name of names) {
      const dir = canvasDir(ctx.projectDir, name);
      if (!existsSync(dir)) {
        ctx.log.error(`no canvas design/${name}`);
        status = 1;
        continue;
      }
      const result = buildCanvas(dir);
      if (!result.ok) {
        ctx.log.error(`design/${name} did not build`);
        status = result.status;
        continue;
      }
      ctx.log.log(`design/${name}: ${result.boards} boards, preview at ${result.preview}`);
    }
    return status;
  },
});
