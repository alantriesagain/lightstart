/**
 * @file A strict static server over a build: no TypeScript, no importmap, missing assets 404, and
 * an extensionless path answers the build's `index.html`. It serves `.deployed/current`.
 */
import { promises as fs } from "node:fs";
import { extname, join } from "node:path";
import { App, type Context, type Reply, text } from "@lightstart/server";
import { serve } from "@lightstart/server/node";
import { Static } from "@lightstart/server/static";
import { MAX_PORT_ATTEMPTS } from "../config.ts";

/** Which build to serve, and where. */
export type DeployedOptions = {
  dir: string;
  port?: number;
  host?: string;
  /** How many ports above the requested one to try; 1 when a caller wants that port or none. */
  attempts?: number;
};

/** A running build preview: its port and one close. */
export type DeployedServer = {
  port: number;
  close(): Promise<void>;
};

const hasExtension = (pathname: string): boolean => extname(pathname) !== "";

const withIndex = (dir: string): Promise<string | null> => fs.access(join(dir, "index.html")).then(() => dir, () => null);

const webRootOf = async (dir: string): Promise<string> => {
  const own = await withIndex(dir);
  if (own !== null) return own;
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  for (const entry of entries) {
    const child = await withIndex(join(dir, entry));
    if (child !== null) return child;
  }
  return dir;
};

/** Serve `dir` as it was built: files as they are, a missing asset a 404, a route its `index.html`. */
export const createDeployedServer = async (options: DeployedOptions): Promise<DeployedServer> => {
  const answer = async (c: Context): Promise<Reply> => {
    const root = await webRootOf(options.dir);
    const files = new Static({ root, dotfiles: true, precompressed: false });
    const found = await files.find(c.path.replace(/^\/+/, ""));
    if (found !== null) return await files.reply(c, found);
    if (!hasExtension(c.path)) {
      const shell = await files.find("index.html");
      if (shell !== null) return await files.reply(c, shell);
    }
    return text("404 Not Found", 404);
  };
  const app = new App().all("/*", answer);
  const start = options.port ?? 0;
  const attempts = options.attempts ?? (start === 0 ? 1 : MAX_PORT_ATTEMPTS);
  let failure: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const server = await serve(app, { port: start + i, host: options.host, grace: 1000 });
      return { port: server.port, close: () => server.close() };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
      failure = error;
    }
  }
  if (failure instanceof Error) throw failure;
  throw new Error(`No free port between ${start} and ${start + attempts - 1}`);
};
