/**
 * @file `light mobile:init`: write `mobile/android` from the template with the
 * app id, name, version, orientation and `minSdk` of `src/mobile`.
 */

import { existsSync, rmSync } from "node:fs";
import { defineCommand } from "@lightstart/cli";
import { appIdentityOf, readMobile, resolveMobile } from "../../../node/config.ts";
import { androidDir, targetSdkOf, writeAndroid, writeLocalProperties } from "../../../node/template.ts";

export default defineCommand({
  description: "Scaffold the Android shell for the project",
  usage: "light mobile:init [--force]",
  args: {
    force: { flag: true, description: "Overwrite an existing mobile/android directory" },
  },
  async run(ctx, args) {
    const config = await readMobile(ctx.projectDir);
    if (config === null) {
      ctx.log.error("No src/mobile.ts or src/mobile.js; export defineMobile({ appId: \"com.example.app\" })");
      return 1;
    }
    const identity = await appIdentityOf(ctx.projectDir);
    const mobile = resolveMobile(config, identity);
    const target = androidDir(ctx.projectDir);
    if (existsSync(target) && !args.force) {
      ctx.log.error(`${target} already exists (use --force to overwrite)`);
      return 1;
    }
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    writeAndroid(ctx.projectDir, mobile, targetSdkOf(ctx.env));
    writeLocalProperties(ctx.projectDir, ctx.env);
    ctx.log.log(`Wrote ${target} for ${mobile.appId}`);
    return 0;
  },
});
