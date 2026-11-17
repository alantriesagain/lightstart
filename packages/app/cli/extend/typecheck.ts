/**
 * @file `light typecheck` extended by the app: generate the manifest before tsc reads it, so a
 * project's tsconfig can cover `.light/`.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/light/cli/extensions.ts";
import { generate } from "../../node/generate.ts";

export default defineExtension("typecheck", {
  async setup(ctx) {
    await generate(ctx.projectDir);
  },
});
