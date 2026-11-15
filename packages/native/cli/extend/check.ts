/**
 * @file `light check` for a native project, or with `--all`: the native conventions over the
 * project, or over the workspace members light check's targets name. In a folder with no native
 * project and without `--all`, light's own check runs unchanged.
 */
import { basename, resolve } from "node:path";
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/light/cli/extensions.ts";
import { findProject } from "../../src/project.js";
import { findRoot, members } from "../../src/workspace.js";
import { checkProject, run } from "../../src/commands/check.js";

/**
 * The project `dir` is in, or null.
 * @param {string} dir
 * @returns {import("../../src/project.js").Project | null}
 */
const projectAt = (dir: string) => {
  try {
    return findProject(dir);
  } catch {
    return null;
  }
};

export default defineExtension("check", {
  args: {
    all: { flag: true, description: "Check every workspace member, not only the project" },
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
    /** @param {string} target */
    const memberNamed = (target: string) => {
      if (workspaceRoot === null) return false;
      const absolute = resolve(ctx.cwd, target);
      return members(workspaceRoot).some((m) => m.name === target || m.dir === absolute || basename(m.dir) === target);
    };
    const names = (args.targets ?? []).filter(memberNamed);
    const all = args.all;
    if (!all && project === null && names.length === 0) return;
    const workspaceMode = all || (project !== null && workspaceRoot === project.dir) || names.length > 0;
    api.run(async (input) => {
      if (!workspaceMode && project !== null) return (await checkProject(project)) === 0;
      const root = workspaceRoot ?? findRoot(ctx.projectDir);
      const targets = input.targets.filter((target) => target !== ctx.cwd);
      return (await run(targets, root)) === 0;
    });
  },
});
