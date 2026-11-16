/**
 * @file `light test` extended by the app: generate the manifest before the
 * command picks its files, so a browser test can import `../.light/main.ts`.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/light/cli/extensions.ts";
import { generate } from "../../node/generate.ts";

export default defineExtension("test", {
  async setup(ctx) {
    await generate(ctx.projectDir);
  },
});
