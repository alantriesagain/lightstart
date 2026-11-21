/**
 * @file `serve:after`: start every canvas's preview beside `light serve` on the next free port,
 * write a missing preview from the index a build wrote, and close the server at shutdown. An
 * ephemeral server is left alone.
 */
import type { CommandContext, HookTeardown } from "@lightstart/cli";
import type { ServeAfterPayload } from "@lightstart/dev";
import { canvasDir, canvasNames, readCanvasIndex, writePreview } from "../../canvas.ts";
import { listenCanvases } from "../../serve.ts";

export default (async (ctx: CommandContext, { projectDir, port, ephemeral, origins }: ServeAfterPayload): Promise<HookTeardown | void> => {
  if (ephemeral) return;
  const names = canvasNames(projectDir);
  if (!names.length) return;

  const ready: string[] = [];
  for (const name of names) {
    const dir = canvasDir(projectDir, name);
    if (!readCanvasIndex(dir)) {
      ctx.log.warn(`[design] design/${name} has no canvas.json; run light design:build ${name}`);
      continue;
    }
    writePreview(dir);
    ready.push(name);
  }
  if (!ready.length) return;

  const host = origins.lan ? "0.0.0.0" : "127.0.0.1";
  const start = port === 0 ? 0 : Math.max(port + 1, 5097);
  const server = await listenCanvases(projectDir, { port: start, host });
  const url = origins.lan ? `${origins.lan.replace(/\/$/, "")}/` : server.url;
  ctx.log.log(`Design canvases: ${url}`);
  return () => server.close();
}) satisfies (ctx: CommandContext, payload: ServeAfterPayload) => Promise<HookTeardown | void>;
