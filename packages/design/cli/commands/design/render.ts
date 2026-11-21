/**
 * @file `light design:render <canvas> [board...]`: render each board of the canvas's `canvas.json`
 * to `design/renders/<canvas>/` at its own size, through Playwright.
 */
import { relative } from "node:path";
import { defineCommand } from "@lightstart/cli";
import { canvasDir, readCanvasIndex } from "../../../canvas.ts";
import { renderCanvas } from "../../../render.ts";

export default defineCommand({
  description: "Render a canvas's boards to PNG at their own size",
  usage: "light design:render <canvas> [board...]",
  args: {
    canvas: { positional: true, description: "Canvas under design/" },
    boards: { positional: true, rest: true, description: "Boards to render (default: every board)" },
  },
  async run(ctx, { canvas, boards }) {
    if (!canvas) {
      ctx.log.error("name a canvas: light design:render <canvas> [board...]");
      return 1;
    }
    const dir = canvasDir(ctx.projectDir, canvas);
    if (!readCanvasIndex(dir)) {
      ctx.log.error(`design/${canvas} has no canvas.json; run light design:build ${canvas}`);
      return 1;
    }
    const only = Array.isArray(boards) ? boards.filter((board) => typeof board === "string") : [];
    try {
      const plan = await renderCanvas(ctx.projectDir, canvas, only);
      if (plan.boards.length === 0) {
        ctx.log.error(only.length ? `no board in design/${canvas} matches ${only.join(", ")}` : `design/${canvas} has no boards`);
        return 1;
      }
      for (const board of plan.boards) ctx.log.log(relative(ctx.projectDir, board.path));
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
