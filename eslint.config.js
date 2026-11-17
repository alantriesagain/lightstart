/** Light lints itself with its own recommended config. */

import recommended from "./packages/light/eslint/recommended.js";

export default [{ ignores: ["**/dist/**", "**/.deployed/**", "**/.light/**", "node_modules/**", "website/**", "packages/light/native/desktop/out/**", "benchmarks/server/load.mjs", ".worktrees/**"] }, recommended];
