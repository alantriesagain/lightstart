/**
 * @file `light-native prepare [member…]`: the prepare steps of the members named (every app by default) and of the
 * packages they depend on.
 */
import { prepare } from "../prepare.js";
import { apps, memberByName } from "../workspace.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const targets = args.length > 0 ? args.map((a) => memberByName(root, a)) : apps(root);
  for (const m of targets) await prepare(root, m);
  return 0;
};
