/**
 * @file `light serve` extended by the app: answer it under the path its
 * `defineApp({ url })` (or `base`) names, and send the root there. The files
 * under the base resolve to the project's own, and the unprefixed paths keep
 * answering too, so the page's root-relative imports need no rewrite.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { appOf, infoOf } from "../../node/generate.ts";
import { setServeProfile } from "../serve-profile.ts";

export default defineExtension("serve", {
  args: {
    profile: { description: "Serve the app's named profile (defineApp({ profiles }))" },
  },
  async setup(ctx, args, api) {
    const given = args as { profile?: unknown } | undefined;
    setServeProfile(typeof given?.profile === "string" && given.profile !== "" ? given.profile : undefined);
    const app = appOf(ctx.projectDir);
    if (app === null) return;
    const info = await infoOf(app.path);
    if (info.base === "") return;
    api.basePath(info.base);
    api.redirect("/", `${info.base}/`);
  },
});
