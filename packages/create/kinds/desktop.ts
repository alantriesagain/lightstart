/**
 * @file The `desktop` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `desktop` kind. */
export const desktop: Kind = {
  name: "desktop",
  description: "A page in light's desktop shell with a native backend",
  packages: ["@lightstart/light"],
  scripts: {
    build: "light desktop build",
    dev: "light desktop run",
    check: "light check",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
  },
};
