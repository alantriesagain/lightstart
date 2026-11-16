/**
 * @file The `web` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `web` kind. */
export const web: Kind = {
  name: "web",
  description: "A web app on @lightstart/app: views, a model, a controller and routes",
  packages: ["@lightstart/light", "@lightstart/components", "@lightstart/app"],
  scripts: {
    dev: "light serve --watch",
    build: "light build",
    test: "light test test/*.test.ts",
    check: "light check",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@lightstart/dev": "^0.1.0",
    "@lightstart/build": "^0.1.0",
    "@lightstart/server": "^0.1.0",
    playwright: "^1.58.2",
  },
};
