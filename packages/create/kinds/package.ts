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
    pack: "node scripts/pack.js",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@lightstart/light": "^0.1.0",
    "@types/node": "^26.6.5",
    typescript: "^6.0.3",
  },
};
