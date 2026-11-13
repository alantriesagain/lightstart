/**
 * @file What the dev server hands a project's route file, and the app it builds.
 */
import type { CliApi, Logger } from "@lightstart/cli";
import type { App } from "@lightstart/server";
import type { Transformed } from "@lightstart/server/static";

/** What a `cli/routes` file's default export receives: the project it serves and the CLI it came from. */
export type RouteContext = {
  projectDir: string;
  log: Logger;
  cli: CliApi;
};

/** A route file's default export: an app built once, from the server's context. */
export type RouteFactory = (ctx: RouteContext) => App;

/** What changes a module's bytes on the way out: TypeScript stripped and bare specifiers rewritten, injected by the node layer. */
export type ModuleTransform = (path: string, body: Uint8Array) => Transformed | null;
