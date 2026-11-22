/**
 * @file `light mobile:run`: build, install on the one attached device and
 * start the activity.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "@lightstart/cli";
import { readMobile } from "../../../node/config.ts";
import { apkPath } from "./build.ts";
import { sdkDirOf } from "../../../node/template.ts";

const adbOf = (env: NodeJS.ProcessEnv): string => {
  const sdk = sdkDirOf(env);
  return sdk === null ? "adb" : join(sdk, "platform-tools", "adb");
};

const attached = (adb: string): string | null => {
  const run = spawnSync(adb, ["devices"], { encoding: "utf8" });
  if (run.status !== 0) return null;
  for (const line of run.stdout.split("\n")) {
    const [serial, state] = line.trim().split(/\s+/);
    if (serial !== undefined && state === "device") return serial;
  }
  return null;
};

export default defineCommand({
  description: "Build, install and start the app on an attached device",
  usage: "light mobile:run",
  args: {},
  async run(ctx) {
    const config = await readMobile(ctx.projectDir);
    if (config === null) {
      ctx.log.error("No src/mobile.ts or src/mobile.js; run 'light mobile:init' first");
      return 1;
    }
    const code = await ctx.cli.runCommand("mobile:build");
    if (code !== 0) return code;
    const apk = apkPath(ctx.projectDir);
    if (!existsSync(apk)) {
      ctx.log.error(`No APK at ${apk}`);
      return 1;
    }
    const adb = adbOf(ctx.env);
    const serial = attached(adb);
    if (serial === null) {
      ctx.log.error("No device attached; connect one with adb or start an emulator");
      return 1;
    }
    ctx.log.log(`Installing on ${serial}`);
    const install = spawnSync(adb, ["-s", serial, "install", "-r", apk], { stdio: "inherit" });
    if ((install.status ?? 1) !== 0) return install.status ?? 1;
    const start = spawnSync(adb, ["-s", serial, "shell", "am", "start", "-n", `${config.appId}/dev.lightstart.mobile.MainActivity`], { stdio: "inherit" });
    return start.status ?? 0;
  },
});
