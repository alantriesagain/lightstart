#!/usr/bin/env node
import { check } from "../check/cli.js";
import { test } from "../test/cli.js";

const [command, ...args] = process.argv.slice(2);
if (command === "test") process.exitCode = (await test(args)) ? 0 : 1;
else if (command === "check") process.exitCode = (await check(args)) ? 0 : 1;
else if (command === "desktop") process.exitCode = await (await import("../native/desktop/build.js")).desktop(args);
else if (command === "serve") process.exitCode = await (await import("../test/serve.js")).serveCommand(args);
else if (command === "classes:bake") process.exitCode = (await (await import("../theme/bake.js")).bake(args)) ? 0 : 1;
else {
  console.error("Usage: light test <files...> | light check [dir] | light serve [dir] [--port <n>] | light desktop shim|smoke|build|run … | light classes:bake <entry> -o <file> [--scheme dark,light] [--check]");
  process.exitCode = 1;
}
