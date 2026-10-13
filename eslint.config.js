/** Light lints itself with its own recommended config. */

import recommended from "./eslint/recommended.js";

export default [{ ignores: ["dist/**", "node_modules/**", "website/**", ".bootstrapp/**", "native/desktop/out/**"] }, recommended];
