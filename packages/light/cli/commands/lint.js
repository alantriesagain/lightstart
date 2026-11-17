import { defineCommand } from "@lightstart/cli";
import { lintProject } from "../lint.js";

export default defineCommand({
  description: "Run eslint over the project",
  usage: "light lint [--fix]",
  args: {
    fix: { flag: true, description: "Fix what eslint can" },
  },
  async run(ctx, args) {
    return await lintProject(ctx.projectDir, { fix: args.fix, log: ctx.log });
  },
});
