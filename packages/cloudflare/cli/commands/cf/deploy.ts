/**
 * @file `light cf:deploy`: upload the app's build (`.deployed/current`, or
 * `--build <id>`) to its Cloudflare Pages project, a preview unless
 * `--production`; `--dry-run` prints the plan and uploads nothing.
 */

import { defineCommand } from "@lightstart/cli";
import { planDeploy, runDeploy, wranglerSteps } from "../../../node/deploy.ts";

export default defineCommand({
  description: "Deploy the app's build to Cloudflare Pages",
  usage: "light cf:deploy [--production] [--build <id>] [--dry-run]",
  args: {
    production: { flag: true, description: "Deploy to the production branch (a preview otherwise)" },
    build: { description: "A build id under .deployed/builds (default: .deployed/current)" },
    "dry-run": { flag: true, description: "Print what would run and upload nothing" },
  },
  async run(ctx, args) {
    let plan;
    try {
      plan = await planDeploy(ctx.projectDir, { build: typeof args.build === "string" && args.build !== "" ? args.build : undefined, production: args.production === true });
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    ctx.log.log(`${plan.production ? "Production" : "Preview"} deploy of ${plan.buildDir} to the Pages project ${plan.project}`);
    if (args["dry-run"] === true) {
      for (const step of wranglerSteps(plan)) ctx.log.log(`wrangler ${step.join(" ")}`);
      return 0;
    }
    return runDeploy(plan, ctx.projectDir, (line) => ctx.log.log(line));
  },
});
