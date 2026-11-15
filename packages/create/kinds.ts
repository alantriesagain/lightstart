/**
 * @file The kinds `light new` can start: a name, a sentence, the light packages the project depends
 * on, its scripts and its devDependencies. The template folder is `templates/<name>/`.
 */

/** One kind of project `light new` writes. */
export type Kind = {
  /** The folder under `templates/` and the word on the command line. */
  name: string;
  /** One line for `light new` with no kind. */
  description: string;
  /** The light packages the project depends on, put under `dependencies`. */
  packages: readonly string[];
  /** The scripts the project's package.json runs. */
  scripts: Record<string, string>;
  /** The project's devDependencies; a `@lightstart/*` name is linked like `packages`. */
  devDependencies: Record<string, string>;
};

/** Every kind, in the order `light new` lists them. */
export const KINDS: readonly Kind[] = [
  {
    name: "web",
    description: "A page of light views and lc-* components",
    packages: ["@lightstart/light", "@lightstart/components"],
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
];

/** The kind named `name`, if the table has it. */
export const kindByName = (name: string): Kind | undefined => KINDS.find((kind) => kind.name === name);

/** A name as a title: `my-app` is `My App`. */
export const titleOf = (name: string): string =>
  name
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
