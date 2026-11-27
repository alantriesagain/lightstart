/**
 * @file `light cf:r2:setup`: create the app's R2 bucket when the account does
 * not have it, then bind it to the Pages project as `STORAGE` (production and
 * preview); prints the bucket name, never a credential.
 */

import { defineCommand } from "@lightstart/cli";
import { cloudflareApi } from "../../../../node/cloudflare-api.ts";
import { bindBucket, ensureBucket, r2Settings } from "../../../../node/r2.ts";

export default defineCommand({
  description: "Create and bind the app's R2 bucket to its Pages project",
  usage: "light cf:r2:setup",
  async run(ctx) {
    try {
      const settings = await r2Settings(ctx.projectDir);
      const api = cloudflareApi({ accountId: settings.accountId, apiToken: settings.apiToken });
      const name = await ensureBucket(api, settings.bucket);
      await bindBucket(api, settings.project, name);
      ctx.log.log(`R2 bucket ${name} is bound to ${settings.project} as STORAGE`);
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
