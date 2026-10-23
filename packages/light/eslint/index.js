/**
 * @bootstrapp/light/eslint: light's eslint plugin. `check-errors` and
 * `check-warnings` are `light check` in the editor: the findings of light's
 * rules and the project's `check/rules/` for the file being linted.
 * `no-non-jsdoc-comments` and `no-explicit-any-jsdoc` hold light's code
 * style. `@bootstrapp/light/eslint/recommended.js` wires them up with the
 * house style; this module loads nothing of eslint.
 */

import { fileURLToPath } from "node:url";
import { loadRulesSync } from "../check/discover.js";
import { openProject } from "../check/project.js";
import { readPackageJson } from "../check/walk.js";
import { checkRules } from "./bridge.js";
import noExplicitAnyJsdoc from "./rules/no-explicit-any-jsdoc.js";
import noNonJsdocComments from "./rules/no-non-jsdoc-comments.js";

const pkg = readPackageJson(fileURLToPath(new URL("../", import.meta.url)));

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: { name: pkg?.name ?? "@bootstrapp/light", version: pkg?.version ?? "0.0.0" },
  rules: {
    ...checkRules((root) => {
      const { context, sources } = openProject(root);
      return { context, rules: loadRulesSync(sources).rules };
    }),
    "no-non-jsdoc-comments": noNonJsdocComments,
    "no-explicit-any-jsdoc": noExplicitAnyJsdoc,
  },
};

export default plugin;
