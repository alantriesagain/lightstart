/**
 * @file The `web` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `web` kind. */
export const web: Kind = {
  name: "web",
  description: "A web app on @lightstart/app: views, a model, a controller and routes",
  languages: ["js", "ts"],
  packages: ["@lightstart/light", "@lightstart/components", "@lightstart/app"],
  scripts: {
    dev: "light serve --watch",
    build: "light build",
    test: "light test test/*.test.*",
    "test:e2e": "node --test test/*.e2e.*",
    check: "light check",
    lint: "light lint",
    typecheck: "light typecheck",
    verify: "light verify",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@lightstart/dev": "^0.1.0",
    "@lightstart/build": "^0.1.0",
    "@lightstart/server": "^0.1.0",
    "@types/node": "^26.6.5",
    "@stylistic/eslint-plugin": "^2.13.0",
    eslint: "^9.17.0",
    "eslint-plugin-lit": "^2.3.1",
    globals: "^15.14.0",
    playwright: "^1.58.2",
    typescript: "^6.0.3",
  },
};
