/**
 * @bootstrapp/light/check/project.js: a project as light checks it on its
 * own, shared by `light check` and the eslint bridge. The project root is the
 * nearest directory holding a package.json; its context knows light's own
 * components, and its rules are light's and the project's `check/rules/`.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext } from "./context.js";
import { ownRuleSources, projectRuleSources } from "./discover.js";
import { readPackageJson, toRel } from "./walk.js";

/** @import { ComponentMap, ProjectContext, RuleSource } from "./types.ts" */

const LIGHT_ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * The nearest directory at or above `dir` holding a package.json, or null.
 * @param {string} dir
 * @returns {string | null}
 */
export const projectRoot = (dir) => {
  for (let current = dir; ; current = path.dirname(current)) {
    if (existsSync(path.join(current, "package.json"))) return current;
    if (path.dirname(current) === current) return null;
  }
};

/**
 * Light's project at `root`, narrowed to `dir` when it lies inside: the
 * context, reading `dir` as a directory of components, and the rule sources.
 * @param {string} root
 * @param {string} [dir]
 * @returns {{ context: ProjectContext, sources: RuleSource[] }}
 */
export const openProject = (root, dir = root) => {
  const scope = dir === root ? null : `${toRel(root, dir)}/`;
  /** @type {ComponentMap} */
  const lightMap = { owner: "light", dir: LIGHT_ROOT, components: readPackageJson(LIGHT_ROOT)?.bootstrapp?.components ?? {} };
  const rootPkg = readPackageJson(root) ?? {};
  const { components: _, ...config } = rootPkg.bootstrapp ?? {};
  const context = createContext({
    projectDir: root,
    pkg: scope ? { ...rootPkg, bootstrapp: config } : rootPkg,
    host: { componentMaps: () => [lightMap], ...(scope ? { scope, componentDirs: () => [scope] } : {}) },
  });
  return { context, sources: [...ownRuleSources(), ...projectRuleSources(root, context.pkg)] };
};
