/**
 * @file What `light serve` starts once it listens: the pidfile, the tunnel and the browser. Its
 * stop() takes the tunnel down and clears the pidfile before the hooks' teardowns run.
 */
import { exec } from "node:child_process";
import type { CommandContext } from "@lightstart/cli";
import { browserCommand } from "./browser.ts";
import { clearPidRecord, writePidRecord } from "./single-instance.ts";
import { startTunnel, type DevTunnel, type Tunnel } from "./tunnel.ts";

/** What the server asked for once it listens. */
export type AfterListenOptions = {
  projectDir: string;
  port: number;
  local: string;
  ephemeral: boolean;
  open: boolean;
  tunnel: boolean;
  named: DevTunnel | null;
};

/** The tunnel that came up, and the teardown the server runs first at shutdown. */
export type AfterListen = { tunnel: Tunnel | null; stop: () => Promise<void> };

const openBrowser = (url: string, log: CommandContext["log"]): void => {
  const command = browserCommand(process.platform, url);
  if (command === null) {
    log.warn(`--open is not supported on ${process.platform}`);
    return;
  }
  log.log(`Opening browser: ${url}`);
  exec(command, (error) => {
    if (error) log.warn(`Failed to open browser: ${error.message}`);
  });
};

/** Start the pidfile, tunnel and browser a listening server needs, in that order. */
export const afterListen = async (ctx: CommandContext, options: AfterListenOptions): Promise<AfterListen> => {
  if (!options.ephemeral) await writePidRecord(options.projectDir, options.port);
  const tunnel = options.tunnel ? await startTunnel({ port: options.port, projectDir: options.projectDir, named: options.named }, ctx.log) : null;
  if (tunnel) {
    ctx.log.log(`Tunnel: ${tunnel.origin}${tunnel.paths.length ? ` (only ${tunnel.paths.join(", ")})` : ""}`);
  }
  if (options.open) openBrowser(options.local, ctx.log);
  return {
    tunnel,
    stop: async () => {
      tunnel?.stop();
      if (!options.ephemeral) await clearPidRecord(options.projectDir);
    },
  };
};
