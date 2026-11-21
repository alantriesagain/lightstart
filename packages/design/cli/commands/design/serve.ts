/**
 * @file `light design:serve [canvas]`: serve a canvas's local preview without rebuilding it.
 */
import { existsSync } from "node:fs";
import { defineCommand } from "@lightstart/cli";
import { canvasDir, canvasInfo, readCanvasIndex, writePreview } from "../../../canvas.ts";
import { listenCanvas, serveUntilSignal } from "../../../serve.ts";

const validPort = (value: string): number | null => {
  const port = Number(value);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : null;
};

export default defineCommand({
  description: "Serve a canvas's local preview without rebuilding it",
  usage: "light design:serve [canvas] [--port <n>] [--host <h>]",
  args: {
    canvas: { positional: true, description: "Canvas under design/ (default: the only canvas)" },
    port: { default: "5097", description: "Port for the preview server (0 asks the system)" },
    host: { default: "127.0.0.1", description: "Host for the preview server" },
  },
  async run(ctx, { canvas, port, host }) {
    const all = canvasInfo(ctx.projectDir);
    const name = canvas || (all.length === 1 ? all[0].name : "");
    if (!name) {
      ctx.log.error(all.length ? `name a canvas: ${all.map((item) => item.name).join(", ")}` : "no canvases under design/");
      return 1;
    }
    const dir = canvasDir(ctx.projectDir, name);
    if (!existsSync(dir)) {
      ctx.log.error(`no canvas design/${name}`);
      return 1;
    }
    if (!readCanvasIndex(dir)) {
      ctx.log.error(`design/${name} has no canvas.json; run light design:build ${name}`);
      return 1;
    }

    const chosen = validPort(port);
    if (chosen === null) {
      ctx.log.error(`--port takes a number from 0 to 65535, not "${port}"`);
      return 1;
    }

    const preview = writePreview(dir);
    const server = await listenCanvas(dir, { port: chosen, host });
    ctx.log.log(`serving design/${name} (${preview.boards} boards) at ${server.url}`);
    await serveUntilSignal(server);
    return 0;
  },
});
