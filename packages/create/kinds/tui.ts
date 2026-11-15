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
    bake: "light classes:bake src/main.ts -o src/classes.baked.ts --scheme dark,light",
    build: "scriptc build src/main.ts -o dist/__NAME__ --strip",
    check: "light check",
  },
  devDependencies: {
    "@lightstart/cli": "^0.1.0",
    "@types/node": "^26.6.5",
    scriptc: "0.4.12",
    typescript: "^6.0.3",
  },
};
