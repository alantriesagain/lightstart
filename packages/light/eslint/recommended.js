/**
 * @bootstrapp/light/eslint/recommended.js: light's house style as one flat
 * config object. The core and stylistic rules light's code is written to,
 * `eslint-plugin-lit`'s checks of html templates, light's two style rules,
 * and the checker's findings as `light/check-errors` and
 * `light/check-warnings`. It needs `eslint`, `@stylistic/eslint-plugin`,
 * `eslint-plugin-lit` and `globals` installed beside it.
 */

import stylistic from "@stylistic/eslint-plugin";
import lit from "eslint-plugin-lit";
import globals from "globals";
import light from "./index.js";

const litRecommended = /** @type {import("eslint").Linter.Config} */ (lit.configs?.["flat/recommended"]);

/** @type {import("eslint").Linter.Config} */
const config = {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: { ...globals.browser, ...globals.node, ...globals.serviceworker },
  },
  plugins: { "@stylistic": /** @type {import("eslint").ESLint.Plugin} */ (stylistic), lit, light },
  rules: {
    curly: ["error", "multi"],
    "no-useless-return": "error",
    "no-else-return": ["error", { allowElseIf: false }],
    "no-lonely-if": "error",
    "no-var": "error",
    "prefer-const": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true }],
    "@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
    "@stylistic/semi": ["error", "always"],
    "@stylistic/comma-dangle": ["error", "always-multiline"],
    "@stylistic/no-trailing-spaces": "error",
    "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0, maxBOF: 0 }],
    ...litRecommended.rules,
    "light/no-non-jsdoc-comments": "error",
    "light/no-explicit-any-jsdoc": "warn",
    "light/check-errors": "error",
    "light/check-warnings": "warn",
  },
};

export default config;
