import { defineCommand } from "@lightstart/cli";
import { runProject } from "../../src/commands/run.js";
import { projectOf } from "../targets.js";

export default defineCommand({
  description: "Build the native project and run it in the folder the command was launched from",
  usage: "light run [--no-build] [--release] [-- args…]",
  args: {
    "no-build": { flag: true, description: "Run the binary already built, without building" },
    release: { flag: true, description: "Build the release binary in dist/ instead of the dev binary in dist/dev/" },
    appArgs: { positional: true, rest: true, description: "Arguments for the app (after --)" },
  },
  async run(ctx, args) {
    return runProject(projectOf(ctx), args.appArgs, ctx.cwd, { release: args.release, noBuild: args["no-build"] });
  },
});
