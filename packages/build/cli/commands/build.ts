import { defineCommand } from "@lightstart/cli";
import { resolve } from "node:path";
import { build } from "../../index.ts";

export default defineCommand({
  description: "Build a page and its assets into a kept build folder",
  usage: "light build [dir] [--page <file>] [--out <dir>] [--no-minify] [--keep <n>]",
  args: {
    dir: { positional: true, description: "The app folder (default: the working directory)" },
    page: { default: "index.html", description: "The page to build" },
    out: { default: ".deployed", description: "The output folder" },
    minify: { flag: true, default: true, description: "Minify the bundles (--no-minify keeps them readable)" },
    keep: { default: "5", description: "How many builds to keep" },
  },
  async run(ctx, { dir, page, out, minify, keep }) {
    const root = resolve(ctx.cwd, dir ?? ".");
    try {
      const report = await build({ root, page, outDir: out, minify, keep: Number(keep), log: (message) => ctx.log.debug(message) });
      for (const file of report.files) ctx.log.log(`${file.path}  ${ctx.formatBytes(file.bytes)}`);
      const total = report.files.reduce((sum, file) => sum + file.bytes, 0);
      ctx.log.log(`${report.files.length} files, ${ctx.formatBytes(total)} in ${report.ms} ms`);
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
