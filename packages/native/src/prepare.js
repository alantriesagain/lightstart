/**
 * @file A member's or a project's steps before a build or a run (`native.prepare`: shell lines run
 * in the folder that holds the package, such as a native archive or generated sources), its
 * dependencies' first; each once per command. A step sees the command it runs for as
 * `LIGHT_NATIVE_COMMAND` (build, test, coverage, typecheck, desktop, prepare), so what it generates
 * can differ for a test run.
 */
import { shell } from "./run.js";
import { dependencyMembers, Member } from "./workspace.js";
import { dependencyClosure, isInstalled } from "./project.js";

/** @type {Set<string>} */
const done = new Set();

/**
 * @param {string} dir
 * @param {string} name
 * @param {{ prepare?: string[] }} config
 * @param {string} command
 * @returns {Promise<void>}
 */
const runSteps = async (dir, name, config, command) => {
  for (const step of config.prepare ?? []) {
    const code = await shell(step, { cwd: dir, env: { ...process.env, LIGHT_NATIVE_COMMAND: command } });
    if (code !== 0) throw new Error(name + ": prepare step failed (" + step + ")");
  }
};

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
    await runSteps(m.dir, m.name, m.config, command);
  }
};

/**
 * A project's dependencies' prepare steps, in dependency order, then its own; a dependency
 * installed as a real folder (not a link) is not written to and is reported as expected prebuilt.
 * @param {import("./project.js").Project} project
 * @param {string} command
 * @returns {Promise<void>}
 */
export const prepareProject = async (project, command) => {
  for (const dependency of dependencyClosure(project)) {
    if (done.has(dependency.realDir)) continue;
    done.add(dependency.realDir);
    if ((dependency.config.prepare ?? []).length === 0) continue;
    if (isInstalled(dependency)) {
      console.log(dependency.name + ": expected prebuilt (" + dependency.realDir + ")");
      continue;
    }
    await runSteps(dependency.dir, dependency.name, dependency.config, command);
  }
  if (done.has(project.realDir)) return;
  done.add(project.realDir);
  await runSteps(project.dir, project.name, project.config, command);
};
