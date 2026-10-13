#!/usr/bin/env node
import { check } from "../check/cli.js";
import { test } from "../test/cli.js";

const [command, ...args] = process.argv.slice(2);
if (command === "test") process.exitCode = (await test(args)) ? 0 : 1;
else if (command === "check") process.exitCode = (await check(args)) ? 0 : 1;
else if (command === "desktop") process.exitCode = await (await import("../native/desktop/build.js")).desktop(args);
else {
  console.error("Usage: light test <files...> | light check [dir] | light desktop shim|smoke|build|run …");
  process.exitCode = 1;
}
