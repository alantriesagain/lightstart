/**
 * @file The `desktop` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `desktop` kind. */
export const desktop: Kind = {
  name: "desktop",
  description: "A page in light's desktop shell with a native backend",
  packages: ["@lightstart/light", "@lightstart/components"],
  scripts: {
    dev: "light desktop run backend.ts --web web --out dist --npm-static @lightstart/light",
    build: "light desktop build backend.ts --web web --out dist --npm-static @lightstart/light",
    test: "node --test test/*.test.ts",
    check: "light check",
    lint: "light lint",
    typecheck: "light typecheck",
    verify: "light verify",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@lightstart/server": "^0.1.0",
    scriptc: "0.4.16",
    "@types/node": "^26.6.5",
    "@stylistic/eslint-plugin": "^2.13.0",
    eslint: "^9.17.0",
    "eslint-plugin-lit": "^2.3.1",
    globals: "^15.14.0",
    typescript: "^6.0.3",
  },
};
