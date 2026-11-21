/**
 * @file `light serve` extended by the app: answer it under the path its
 * `defineApp({ url })` (or `base`) names, and send the root there. The files
 * under the base resolve to the project's own, and the unprefixed paths keep
 * answering too, so the page's root-relative imports need no rewrite.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { appOf, infoOf } from "../../node/generate.ts";

export default defineExtension("serve", {
  async setup(ctx, _args, api) {
    const app = appOf(ctx.projectDir);
    if (app === null) return;
    const info = await infoOf(app.path);
    if (info.base === "") return;
    api.basePath(info.base);
    api.redirect("/", `${info.base}/`);
  },
});
