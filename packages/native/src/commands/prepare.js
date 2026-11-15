/**
 * @file `light-native prepare [member…]`: the prepare steps of the members named (every app by default) and of the
 * packages they depend on.
 */
import { prepare, prepareProject } from "../prepare.js";
import { apps, memberByName } from "../workspace.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const targets = args.length > 0 ? args.map((a) => memberByName(root, a)) : apps(root);
  for (const m of targets) await prepare(root, m, "prepare");
  return 0;
};

/**
 * A project's prepare steps, its dependencies' first.
 * @param {import("../project.js").Project} project
 * @returns {Promise<number>}
 */
export const runProject = async (project) => {
  await prepareProject(project, "prepare");
  return 0;
};
