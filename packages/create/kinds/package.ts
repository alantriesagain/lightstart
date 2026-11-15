/**
 * @file The `package` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `package` kind. */
export const pkg: Kind = {
  name: "package",
  description: "A light package with modules, tests and a README",
  packages: [],
  scripts: {
    test: "node --test test/*.test.ts",
    check: "light check",
    pack: "node scripts/pack.js",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
  },
};
