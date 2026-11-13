/**
 * @file `light serve`: resolve the project, run the hooks, build the pipeline, listen on the first
 * free port, watch and broadcast changes, and take everything down on SIGINT or SIGTERM.
 */
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import type { CommandContext } from "@lightstart/cli";
import { App, fail } from "@lightstart/server";
import { serve, type NodeServer } from "@lightstart/server/node";
import { MAX_PORT_ATTEMPTS, resolvePort } from "../config.ts";
import { importmapFromHtml, mergeImportMaps, type ImportMap } from "../importmap.ts";
import { createPipeline } from "../pipeline.ts";
import type { RouteFactory } from "../types.ts";
import { createDeployedServer } from "./deployed.ts";
import { attachSockets } from "./hmr.ts";
import { buildImportMap, devPortOf, readPackageJson } from "./importmap.ts";
import { createModuleTransform } from "./transform.ts";
import { startWatcher } from "./watch.ts";

/** What `light serve` accepts after its flags are parsed. */
export type ServeArgs = {
  dir?: string;
  port?: string | number;
  host?: string;
  watch?: boolean;
  build?: boolean;
};

const bindHostFor = (host: string): string => (host === "localhost" ? "127.0.0.1" : host);

const lanAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flat()
    .filter((info) => info !== undefined && info.family === "IPv4" && !info.internal)
    .map((info) => (info === undefined ? "" : info.address))
    .filter((address) => address !== "");

const resolveProjectDir = async (cwd: string, dir: string | undefined): Promise<string> => {
  if (dir === undefined || dir === "") return cwd;
  const candidate = resolvePath(cwd, dir);
  const found = await stat(candidate).catch(() => null);
  return found !== null && found.isDirectory() ? candidate : cwd;
};

const listenOnFreePort = async (app: App, port: number, host: string): Promise<NodeServer> => {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    try {
      return await serve(app, { port: port + i, host, grace: 1000 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No free port between ${port} and ${port + MAX_PORT_ATTEMPTS - 1} on ${host}`);
};

const projectImportMap = async (projectDir: string): Promise<ImportMap> => {
  const built = buildImportMap(projectDir);
  const html = await readFile(join(projectDir, "index.html"), "utf8").catch(() => "");
  return mergeImportMaps(built, importmapFromHtml(html));
};

const routeFactories = async (ctx: CommandContext): Promise<RouteFactory[]> => {
  const out: RouteFactory[] = [];
  for (const route of await ctx.cli.loadRoutes()) if (typeof route === "function") out.push(route as RouteFactory);
  return out;
};

const urlsFor = (port: number, host: string): { local: string; lan: string[] } => {
  const local = `http://${host === "0.0.0.0" || host === "127.0.0.1" ? "localhost" : host}:${port}`;
  return { local, lan: host === "0.0.0.0" ? lanAddresses().map((address) => `http://${address}:${port}`) : [] };
};

/** Start a dev server (or, with `--build`, a build preview) and resolve when it closes. */
export const startServer = async (ctx: CommandContext, args: ServeArgs): Promise<number> => {
  const projectDir = await resolveProjectDir(ctx.cwd, args.dir);
  const pkg = readPackageJson(projectDir);
  const basePort = resolvePort({ argsPort: args.port, pkgPort: devPortOf(pkg), env: ctx.env });
  const host = bindHostFor(args.host ?? "127.0.0.1");
  const watch = args.watch === true;
  const before = await ctx.cli.runHook("serve:before", { projectDir, port: basePort, watch });

  if (args.build === true) {
    const dir = join(projectDir, ".deployed", "current");
    const found = await stat(dir).catch(() => null);
    if (found === null) {
      ctx.log.error(`No build at ${dir}: run light build first`);
      await before.teardown();
      return 1;
    }
    const server = await createDeployedServer({ dir, port: basePort, host });
    const urls = urlsFor(server.port, host);
    ctx.log.log(`Serving the build at ${urls.local}`);
    for (const url of urls.lan) ctx.log.log(`LAN: ${url}`);
    const after = await ctx.cli.runHook("serve:after", {
      projectDir,
      port: server.port,
      watch: false,
      origins: { local: urls.local, ...(urls.lan[0] === undefined ? {} : { lan: urls.lan[0] }) },
    });
    return await new Promise<number>((resolve: (code: number) => void) => {
      let closing = false;
      const shutdown = async (): Promise<void> => {
        if (closing) return;
        closing = true;
        await after.teardown();
        await before.teardown();
        await server.close();
        resolve(0);
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    });
  }

  const importmap = await projectImportMap(projectDir);
  const routes = await routeFactories(ctx);
  const pipeline = createPipeline({
    projectDir,
    log: ctx.log,
    cli: ctx.cli,
    routes,
    importmap,
    transform: createModuleTransform(importmap),
    watch,
  });
  const app = new App().all("/*", async (c) => (await pipeline.handle(c)) ?? fail("Not found: " + c.path, 404));
  const server = await listenOnFreePort(app, basePort, host);
  const sockets = attachSockets(server.server, pipeline.apps);
  const watcher = watch
    ? startWatcher(projectDir, (event) => {
        sockets.broadcast({ type: "file-changed", path: event.path });
        void ctx.cli.runHook("serve:file-changed", { path: event.path, type: event.type });
      }, ctx.log)
    : null;

  const urls = urlsFor(server.port, host);
  ctx.log.log(`Dev server running at ${urls.local}`);
  for (const url of urls.lan) ctx.log.log(`LAN: ${url}`);
  if (watch) ctx.log.log(`Watching ${projectDir} for changes`);

  const after = await ctx.cli.runHook("serve:after", {
    projectDir,
    port: server.port,
    watch,
    origins: { local: urls.local, ...(urls.lan[0] === undefined ? {} : { lan: urls.lan[0] }) },
  });

  return await new Promise<number>((resolve: (code: number) => void) => {
    let closing = false;
    const shutdown = async (): Promise<void> => {
      if (closing) return;
      closing = true;
      ctx.log.log("Shutting down...");
      await after.teardown();
      await before.teardown();
      watcher?.close();
      sockets.close();
      await server.close();
      resolve(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
};
