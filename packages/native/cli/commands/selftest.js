import { defineCommand } from "@lightstart/cli";
import { runProject } from "../../src/commands/selftest.js";
import { projectOf } from "../targets.js";

export default defineCommand({
  description: "Build the native project and run one of its selftest scenarios in a pseudo-terminal",
  usage: "light selftest <scenario> [--no-build] [-- args…]",
  args: {
    scenario: { positional: true, required: true, description: "The native.selftests entry" },
    "no-build": { flag: true, description: "Run the binary already in dist/" },
    appArgs: { positional: true, rest: true, description: "Arguments for the app (after --)" },
  },
  async run(ctx, args) {
    const rest = [...(args["no-build"] ? ["--no-build"] : []), ...args.appArgs];
    return runProject(projectOf(ctx), args.scenario, rest);
  },
});
