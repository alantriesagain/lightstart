/** Light lints itself with its own recommended config. */

import recommended from "./packages/light/eslint/recommended.js";

export default [{ ignores: ["**/dist/**", "node_modules/**", "website/**", "**/.bootstrapp/**", "packages/light/native/desktop/out/**"] }, recommended];
