import { defineCommand } from "@lightstart/cli";
import { run, runProject } from "../../src/commands/coverage.js";
import { targetsOf } from "../targets.js";

export default defineCommand({
  description: "scriptc's static coverage of the project's entry and tests",
  usage: "light coverage [--apps] [--jobs N] [--all] [member…]",
  args: {
    apps: { flag: true, description: "Only the app entry, not every test" },
    jobs: { description: "Entries analysed at a time (default: $JOBS or 4)" },
    all: { flag: true, description: "The workspace members, not only the project" },
    members: { positional: true, rest: true, description: "Workspace members (with --all)" },
  },
  async run(ctx, args) {
    const { root, targets, project } = targetsOf(ctx, args.members, args.all);
    const flags = ["--jobs", args.jobs ?? process.env["JOBS"] ?? "4"];
    if (args.apps) flags.push("--apps");
    if (project !== null) return runProject(project, flags);
    return run([...targets.map((m) => m.name), ...flags], root);
  },
});
