/**
 * @file `light cf:d1:setup`: create the app's D1 database when the account
 * does not have it, then bind it to the Pages project as `DB` (production and
 * preview); prints the database name and uuid, never a credential.
 */

import { defineCommand } from "@lightstart/cli";
import { cloudflareApi } from "../../../../node/cloudflare-api.ts";
import { bindDatabase, d1Settings, ensureDatabase } from "../../../../node/d1.ts";

export default defineCommand({
  description: "Create and bind the app's D1 database to its Pages project",
  usage: "light cf:d1:setup",
  async run(ctx) {
    try {
      const settings = await d1Settings(ctx.projectDir);
      const api = cloudflareApi({ accountId: settings.accountId, apiToken: settings.apiToken });
      const uuid = await ensureDatabase(api, settings.database);
      await bindDatabase(api, settings.project, uuid);
      ctx.log.log(`D1 database ${settings.database} (${uuid}) is bound to ${settings.project}`);
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
