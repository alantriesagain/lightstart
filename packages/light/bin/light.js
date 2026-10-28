#!/usr/bin/env node
import { check } from "../check/cli.js";

/**
 * Whether `error` is the import of `@lightstart/server` failing: an optional peer that `light test`,
 * `light serve` and the desktop shell need and a project without them never installs.
 * @param {unknown} error
 */
const needsServer = (error) =>
  error instanceof Error && /** @type {{ code?: unknown }} */ (error).code === "ERR_MODULE_NOT_FOUND" && error.message.includes("@lightstart/server");

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "test") process.exitCode = (await (await import("../test/cli.js")).test(args)) ? 0 : 1;
  else if (command === "check") process.exitCode = (await check(args)) ? 0 : 1;
  else if (command === "desktop") process.exitCode = await (await import("../native/desktop/build.js")).desktop(args);
  else if (command === "serve") process.exitCode = await (await import("../test/serve.js")).serveCommand(args);
  else if (command === "classes:bake") process.exitCode = (await (await import("../theme/bake.js")).bake(args)) ? 0 : 1;
  else {
    console.error("Usage: light test <files...> | light check [dir] | light serve [dir] [--port <n>] | light desktop shim|smoke|build|run … | light classes:bake <entry> -o <file> [--scheme dark,light] [--check]");
    process.exitCode = 1;
  }
} catch (error) {
  if (!needsServer(error)) throw error;
  console.error(`light ${command} needs @lightstart/server, an optional peer of @lightstart/light: npm i -D @lightstart/server`);
  process.exitCode = 1;
}
