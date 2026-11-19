/**
 * @file `light app`: generate `.light/app.ts` or `.light/app.js` (and the
 * matching entry) now, and print what the project's folders hold.
 */

import { defineCommand } from "@lightstart/cli";
import { generate } from "../../node/generate.ts";

export default defineCommand({
  description: "Generate the app's manifest from its folders",
  usage: "light app",
  async run(ctx) {
    const result = await generate(ctx.projectDir);
    if (result === null) return 0;
    const parts = [
      `${String(result.models.length)} models`,
      `${String(result.controllers.length)} controllers`,
      `${String(result.views.length)} views`,
      result.routes ? "routes" : "no routes",
    ];
    const manifest = result.manifest.slice(result.dir.length + 1);
    ctx.log.log(`${result.changed ? "wrote" : "unchanged"} .light/${manifest}: ${parts.join(", ")}`);
    return 0;
  },
});
