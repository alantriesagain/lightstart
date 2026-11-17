import { defineCommand } from "@lightstart/cli";
import { typecheckProject } from "../typecheck.js";

export default defineCommand({
  description: "Typecheck the project with tsc",
  usage: "light typecheck",
  async run(ctx) {
    /** @type {Array<() => Promise<boolean> | boolean>} */
    const replacements = [];
    /** @type {import("../extensions.ts").TypecheckExtension} */
    const api = {
      run(fn) {
        replacements.push(fn);
      },
    };
    await ctx.cli.extend("typecheck", api);
    if (replacements.length > 0) return (await replacements[0]()) ? 0 : 1;
    return await typecheckProject(ctx.projectDir, { log: ctx.log });
  },
});
