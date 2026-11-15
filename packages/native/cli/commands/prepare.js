import { defineCommand } from "@lightstart/cli";
import { run, runProject } from "../../src/commands/prepare.js";
import { targetsOf } from "../targets.js";

export default defineCommand({
  description: "The project's native.prepare steps, its dependencies' first",
  usage: "light prepare [--all] [member…]",
  args: {
    all: { flag: true, description: "The workspace members, not only the project" },
    members: { positional: true, rest: true, description: "Workspace members (with --all)" },
  },
  async run(ctx, args) {
    const { root, targets, project } = targetsOf(ctx, args.members, args.all);
    if (project !== null) return runProject(project);
    return run(targets.map((m) => m.name), root);
  },
});
