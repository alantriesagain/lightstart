/** This example lints with light's recommended config. */

import recommended from "@lightstart/light/eslint/recommended.js";

export default [{ ignores: ["node_modules/**", "dist/**", ".deployed/**", ".light/**", ".data/**"] }, recommended];
