/**
 * @file A member's steps before a build or a run (`native.prepare`: shell lines run in the member's folder,
 * such as a native archive or generated sources), its dependencies' first; each member once per
 * command.
 */
import { shell } from "./run.js";
import { dependencyMembers, Member } from "./workspace.js";

/** @type {Set<string>} */
const done = new Set();

/**
 * @param {string} root
 * @param {Member} member
 * @returns {Promise<void>}
 */
export const prepare = async (root, member) => {
  for (const m of [...dependencyMembers(root, member), member]) {
    if (done.has(m.dir)) continue;
    done.add(m.dir);
    const steps = m.config.prepare ?? [];
    for (const step of steps) {
      const code = await shell(step, { cwd: m.dir });
      if (code !== 0) throw new Error(m.name + ": prepare step failed (" + step + ")");
    }
  }
};
