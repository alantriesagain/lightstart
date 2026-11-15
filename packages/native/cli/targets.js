/**
 * @file What a `light` native command works on: the project of the current folder, or with `--all`
 * (or member names) the members of the workspace the folder is in.
 */
import { findProject } from "../src/project.js";
import { findRoot, memberByName, members } from "../src/workspace.js";

/**
 * @typedef {object} Targets
 * @property {string} root
 * @property {import("../src/workspace.js").Member[]} targets
 * @property {import("../src/project.js").Project | null} project
 */

/**
 * The project the command runs in.
 * @param {{ projectDir: string }} ctx
 * @returns {import("../src/project.js").Project}
 */
export const projectOf = (ctx) => findProject(ctx.projectDir);

/**
 * The project, or the workspace members `names` or `--all` ask for.
 * @param {{ projectDir: string }} ctx
 * @param {string[]} names
 * @param {boolean} all
 * @returns {Targets}
 */
export const targetsOf = (ctx, names, all) => {
  if (!all && names.length === 0) {
    const project = findProject(ctx.projectDir);
    return { root: project.dir, targets: [project], project };
  }
  const root = findRoot(ctx.projectDir);
  const targets = names.length > 0 ? names.map((n) => memberByName(root, n)) : members(root);
  return { root, targets, project: null };
};
