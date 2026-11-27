/**
 * @file `light cf:secrets`: put each of `src/cloudflare`'s `secrets` from the
 * project's `.env` onto the Pages project, production through wrangler with the
 * value on stdin and preview through the API, and print only the names;
 * `--dry-run` lists the names and names any that `.env` lacks.
 */

import { defineCommand } from "@lightstart/cli";
import { cloudflareApi } from "../../../node/cloudflare-api.ts";
import { credentialsOf } from "../../../node/d1.ts";
import { pushPreviewSecrets, pushSecrets, secretRunner, secretsToPush } from "../../../node/secrets.ts";

export default defineCommand({
  description: "Put the app's secrets from .env onto its Cloudflare Pages project",
  usage: "light cf:secrets [--dry-run]",
  args: {
    "dry-run": { flag: true, description: "List the names and put nothing" },
  },
  async run(ctx, args) {
    let plan;
    try {
      plan = await secretsToPush(ctx.projectDir);
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    for (const name of plan.missing) ctx.log.warn(`Missing ${name} in .env; not put on ${plan.project}`);
    if (args["dry-run"] === true) {
      for (const secret of plan.secrets) ctx.log.log(secret.name);
      return 0;
    }
    if (plan.secrets.length === 0) return 0;
    try {
      const credentials = credentialsOf(ctx.projectDir, ctx.env);
      const put = pushSecrets(plan, secretRunner(credentials.env));
      for (const name of put) ctx.log.log(`Put ${name} on ${plan.project}`);
      const previewed = await pushPreviewSecrets(plan, cloudflareApi({ accountId: credentials.accountId, apiToken: credentials.apiToken }));
      ctx.log.log(`Put ${String(previewed.length)} secrets on ${plan.project}'s preview environment`);
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
