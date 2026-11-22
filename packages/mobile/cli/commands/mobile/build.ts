/**
 * @file `light mobile:build`: sync the page, then `./gradlew assembleDebug`
 * offline, and print the APK.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "@lightstart/cli";
import { androidDir } from "../../../node/template.ts";

/** Where the debug APK lands in the shell. */
export const apkPath = (project: string): string => join(androidDir(project), "app", "build", "outputs", "apk", "debug", "app-debug.apk");

export default defineCommand({
  description: "Sync the app and build the Android debug APK",
  usage: "light mobile:build",
  args: {},
  async run(ctx) {
    const code = await ctx.cli.runCommand("mobile:sync");
    if (code !== 0) return code;
    const dir = androidDir(ctx.projectDir);
    const gradlew = join(dir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
    if (!existsSync(gradlew)) {
      ctx.log.error(`No ${gradlew}; run 'light mobile:init' first`);
      return 1;
    }
    const run = spawnSync(gradlew, ["assembleDebug", "--offline"], { cwd: dir, stdio: "inherit" });
    const status = run.status ?? 1;
    if (status === 0) ctx.log.log(`APK ${apkPath(ctx.projectDir)}`);
    return status;
  },
});
