/**
 * @file The `tui` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `tui` kind. */
export const tui: Kind = {
  name: "tui",
  description: "A terminal app on @lightstart/app: a model, a controller and views, compiled by scriptc",
  packages: ["@lightstart/light", "@lightstart/app"],
  scripts: {
    dev: "light run",
    test: "light test",
    build: "light build",
    check: "light check",
    lint: "light lint",
    typecheck: "light typecheck",
    verify: "light verify",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@lightstart/native": "^0.1.0",
    "@lightstart/build": "^0.1.0",
    "@lightstart/test": "^0.1.0",
    "@types/node": "^26.6.5",
    "@stylistic/eslint-plugin": "^2.13.0",
    eslint: "^9.17.0",
    "eslint-plugin-lit": "^2.3.1",
    globals: "^15.14.0",
    scriptc: "0.4.12",
    typescript: "^6.0.3",
  },
  manifest: {
    native: {
      entry: ".light/main.ts",
      binary: "__NAME__",
      prepare: ["light app"],
    },
  },
};
