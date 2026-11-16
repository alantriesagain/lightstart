/**
 * @file `light build` extended by the app: a step that runs before the page is
 * read and generates the manifest, so the build sees the project's folders.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build";
import { generate } from "../../node/generate.ts";

export default defineExtension("build", {
  setup(_ctx, _args, api) {
    api.steps.before("page", {
      name: "app",
      async run(ctx) {
        await generate(ctx.root);
      },
    });
  },
});
