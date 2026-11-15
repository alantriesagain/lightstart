/**
 * @file A member's steps before a build or a run (`native.prepare`: shell lines run in the member's folder,
 * such as a native archive or generated sources), its dependencies' first; each member once per
 * command. A step sees the command it runs for as `LIGHT_NATIVE_COMMAND` (build, test, coverage,
 * typecheck, desktop, prepare), so what it generates can differ for a test run.
 */
import { shell } from "./run.js";
import { dependencyMembers, Member } from "./workspace.js";

/** @type {Set<string>} */
const done = new Set();

/**
 * @param {string} root
 * @param {Member} member
 * @param {string} command
 * @returns {Promise<void>}
 */
export const prepare = async (root, member, command) => {
  for (const m of [...dependencyMembers(root, member), member]) {
    if (done.has(m.dir)) continue;
    done.add(m.dir);
    const steps = m.config.prepare ?? [];
    for (const step of steps) {
      const code = await shell(step, { cwd: m.dir, env: { ...process.env, LIGHT_NATIVE_COMMAND: command } });
      if (code !== 0) throw new Error(m.name + ": prepare step failed (" + step + ")");
    }
  }
};
