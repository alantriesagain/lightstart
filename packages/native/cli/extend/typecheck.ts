/**
 * @file `light typecheck` for a native project, or with `--all`: tsc over each member's own
 * tsconfig.json after its prepare steps, generated sources must exist. Anywhere else light's own
 * run is unchanged.
 */
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/light/cli/extensions.ts";
import { findProject } from "../../src/project.js";
import { findRoot } from "../../src/workspace.js";
import { run, runProject } from "../../src/commands/typecheck.js";
import { targetsOf } from "../targets.js";

/** The project `dir` is in, or null. */
const projectAt = (dir: string): import("../../src/project.js").Project | null => {
  try {
    return findProject(dir);
  } catch {
    return null;
  }
};

export default defineExtension("typecheck", {
  args: {
    all: { flag: true, description: "The workspace members, not only the project" },
    members: { positional: true, rest: true, description: "Workspace members (with --all)" },
  },
  setup(ctx, args, api) {
    const project = projectAt(ctx.projectDir);
    /** @type {string | null} */
    let workspaceRoot = null;
    try {
      workspaceRoot = findRoot(ctx.projectDir);
    } catch {
      workspaceRoot = null;
    }
    const members = Array.isArray(args.members) ? args.members.filter((member) => typeof member === "string") : [];
    const all = args.all === true;
    const workspaceMode = all || members.length > 0;
    if (!workspaceMode && project === null) return;
    if (workspaceMode && workspaceRoot === null) return;
    api.run(async () => {
      const { root, targets, project: target } = targetsOf(ctx, members, all);
      if (target !== null) return (await runProject(target)) === 0;
      return (await run(targets.map((member) => member.name), root)) === 0;
    });
  },
});
