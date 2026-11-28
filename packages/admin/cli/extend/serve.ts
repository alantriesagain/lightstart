/**
 * @file `light serve` extended by the admin: mount the guarded dev file API
 * under `/__admin`, its token made once per server start and the folders read
 * from the project's `src/admin`.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { adminFoldersOf, adminTitleOf, readAdmin } from "../../node/config.ts";
import { createAdminApp, newAdminToken } from "../../node/serve.ts";

export default defineExtension("serve", {
  async setup(ctx, _args, api) {
    const config = await readAdmin(ctx.projectDir);
    api.handle(
      createAdminApp({
        projectDir: ctx.projectDir,
        folders: adminFoldersOf(config),
        title: adminTitleOf(config),
        token: newAdminToken(),
      }),
    );
  },
});
