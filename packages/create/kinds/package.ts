/**
 * @file The `package` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `package` kind. */
export const pkg: Kind = {
  name: "package",
  description: "A light package with modules, tests and a README",
  packages: [],
  publishable: true,
  next: "test",
  manifest: {
    version: "0.1.0",
    exports: { ".": "./index.ts", "./*": "./*" },
    files: ["**/*.js", "**/*.d.ts"],
    publishConfig: { access: "public" },
  },
  scripts: {
    test: "node --test test/*.test.ts",
    typecheck: "tsc -p tsconfig.json",
    check: "light check",
    lint: "light lint",
    verify: "light verify",
    pack: "node scripts/pack.js",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@lightstart/light": "^0.1.0",
    "@types/node": "^26.6.5",
    "@stylistic/eslint-plugin": "^2.13.0",
    eslint: "^9.17.0",
    "eslint-plugin-lit": "^2.3.1",
    globals: "^15.14.0",
    typescript: "^6.0.3",
  },
};
