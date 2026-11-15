/**
 * @file The `tui` kind of `light new`.
 */
import type { Kind } from "../kinds.ts";

/** The `tui` kind. */
export const tui: Kind = {
  name: "tui",
  description: "A terminal app on light's terminal host",
  packages: ["@lightstart/light"],
  scripts: {
    dev: "node src/main.ts",
    test: "node --test test/*.test.ts",
    build: "scriptc build src/main.ts -o dist/tui",
    check: "light check",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
  },
};
