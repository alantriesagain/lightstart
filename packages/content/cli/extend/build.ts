/**
 * @file `light build` extended by content: write `content/<model>.json` and
 * `content/<model>/<slug>.json` for every model whose store's adapter is
 * `content`, so the built page can open the read-only content store.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build";
import type { BuildContext } from "@lightstart/build/types.ts";
import { contentFiles } from "../../node.ts";

const runContent = async (ctx: BuildContext): Promise<void> => {
  for (const [path, content] of await contentFiles(ctx.root)) ctx.outputs.set(path, content);
};

export default defineExtension("build", {
  setup(_ctx, _args, api) {
    const step = { name: "content", run: runContent };
    if (api.steps.names().includes("prerender")) api.steps.before("prerender", step);
    else api.steps.add(step);
  },
});
