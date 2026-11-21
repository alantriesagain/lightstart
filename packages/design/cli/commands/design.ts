/**
 * @file `light design [canvas]`: list the canvases under `design/`, or build one and serve its
 * local preview.
 */
import { existsSync } from "node:fs";
import { defineCommand } from "@lightstart/cli";
import { buildCanvas, canvasDir, canvasInfo } from "../../canvas.ts";
import { listenCanvas, serveUntilSignal } from "../../serve.ts";

const validPort = (value: string): number | null => {
  const port = Number(value);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : null;
};

export default defineCommand({
  description: "Build a design canvas and serve its local preview",
  usage: "light design [canvas] [--build] [--port <n>] [--host <h>]",
  args: {
    canvas: { positional: true, description: "Canvas under design/ (default: list the canvases)" },
    build: { flag: true, description: "Build only, do not serve" },
    port: { default: "5097", description: "Port for the preview server (0 asks the system)" },
    host: { default: "127.0.0.1", description: "Host for the preview server" },
  },
  async run(ctx, { canvas, build, port, host }) {
    if (!canvas) {
      const all = canvasInfo(ctx.projectDir);
      if (!all.length) {
        ctx.log.log("no canvases under design/ (a canvas is a folder with a build.mjs)");
        return 0;
      }
      for (const item of all) ctx.log.log(`${item.name.padEnd(12)} ${item.built ? `${item.boards} boards` : "not built"}`);
      return 0;
    }

    const dir = canvasDir(ctx.projectDir, canvas);
    if (!existsSync(dir)) {
      ctx.log.error(`no canvas design/${canvas}`);
      return 1;
    }

    const result = buildCanvas(dir);
    if (!result.ok) {
      ctx.log.error(`design/${canvas} did not build`);
      return result.status;
    }
    ctx.log.log(`design/${canvas}: ${result.boards} boards, preview at ${result.preview}`);
    if (build) return 0;

    const chosen = validPort(port);
    if (chosen === null) {
      ctx.log.error(`--port takes a number from 0 to 65535, not "${port}"`);
      return 1;
    }

    const server = await listenCanvas(dir, { port: chosen, host });
    ctx.log.log(`serving design/${canvas} at ${server.url}`);
    await serveUntilSignal(server);
    return 0;
  },
});
