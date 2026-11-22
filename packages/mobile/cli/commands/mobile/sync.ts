/**
 * @file `light mobile:sync`: build the app, copy the build into the shell's
 * assets, and rewrite the config-derived files so a changed `src/mobile`
 * reaches the project without a new init.
 */

import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "@lightstart/cli";
import { appIdentityOf, readMobile, resolveMobile } from "../../../node/config.ts";
import { androidDir, assetsDir, rewriteAndroid, targetSdkOf, writeLocalProperties } from "../../../node/template.ts";

export default defineCommand({
  description: "Build the app and copy it into the Android shell",
  usage: "light mobile:sync",
  args: {},
  async run(ctx) {
    const config = await readMobile(ctx.projectDir);
    if (config === null) {
      ctx.log.error("No src/mobile.ts or src/mobile.js; run 'light mobile:init' first");
      return 1;
    }
    if (!existsSync(androidDir(ctx.projectDir))) {
      ctx.log.error(`No ${androidDir(ctx.projectDir)}; run 'light mobile:init' first`);
      return 1;
    }
    const code = await ctx.cli.runCommand("build");
    if (code !== 0) return code;
    const current = join(ctx.projectDir, ".deployed", "current");
    if (!existsSync(current)) {
      ctx.log.error("No .deployed/current after the build");
      return 1;
    }
    const build = realpathSync(current);
    const target = assetsDir(ctx.projectDir);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    cpSync(build, target, { recursive: true });
    const identity = await appIdentityOf(ctx.projectDir);
    rewriteAndroid(ctx.projectDir, resolveMobile(config, identity), targetSdkOf(ctx.env));
    writeLocalProperties(ctx.projectDir, ctx.env);
    ctx.log.log(`Synced ${build} to ${target}`);
    return 0;
  },
});
