/**
 * @file `light images:normalize`: cap oversized images and write the missing
 * variant siblings (e.g. `_thumb`) in the project's configured asset dirs.
 */

import { defineCommand } from "@lightstart/cli";
import { imagesConfig, normalizeImages } from "../../../normalize.js";
import type { ImagesConfig } from "../../../types.ts";

export default defineCommand({
  description: "Cap oversized images and generate their variant siblings (e.g. _thumb) in the project's configured asset dirs",
  usage: "light images:normalize [--dirs a,b] [--max-px N] [--dry-run]",
  args: {
    dirs: { description: "Comma-separated dirs to sweep (default: light.images.dirs)" },
    "max-px": { description: "Long-edge cap for the full image (default 1280)" },
    "max-bytes": { description: "Byte budget for the full image (default 307200)" },
    "dry-run": { flag: true, description: "List pending work without writing" },
  },
  async run(ctx, args) {
    const cfg: ImagesConfig = await imagesConfig(ctx.projectDir);
    if (args.dirs) cfg.dirs = String(args.dirs).split(",").map((d: string) => d.trim()).filter(Boolean);
    if (args["max-px"]) cfg.maxPx = Number(args["max-px"]);
    if (args["max-bytes"]) cfg.maxBytes = Number(args["max-bytes"]);
    if (!cfg.dirs.length) {
      ctx.log.error("no image dirs configured; add light.images.dirs to package.json or pass --dirs");
      return 1;
    }
    try {
      await normalizeImages({ root: ctx.projectDir, ...cfg, log: ctx.log.log, dryRun: args["dry-run"] === true });
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
