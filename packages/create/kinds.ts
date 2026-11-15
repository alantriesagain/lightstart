/**
 * @file The kinds `light new` can start: a name, a sentence, the light packages the project depends
 * on, its scripts and its devDependencies. The template folder is `templates/<name>/`.
 */
import { web } from "./kinds/web.ts";
import { tui } from "./kinds/tui.ts";
import { desktop } from "./kinds/desktop.ts";
import { pkg } from "./kinds/package.ts";

/** One kind of project `light new` writes. */
export type Kind = {
  /** The folder under `templates/` and the word on the command line. */
  name: string;
  /** One line for `light new` with no kind. */
  description: string;
  /** The light packages the project depends on, put under `dependencies`. */
  packages: readonly string[];
  /** The scripts the project's package.json runs; `__NAME__` is the project's name. */
  scripts: Record<string, string>;
  /** The project's devDependencies; a `@lightstart/*` name is linked like `packages`. */
  devDependencies: Record<string, string>;
  /** More package.json fields, written after the name (a package's `version`, `exports`, `files`, `publishConfig`). */
  manifest?: Record<string, unknown>;
  /** A project published to a registry: its package.json is not `private`. */
  publishable?: boolean;
  /** The script the "Next:" line names once the project is written; `dev` by default. */
  next?: string;
};

/** Every kind, in the order `light new` lists them. */
export const KINDS: readonly Kind[] = [web, tui, desktop, pkg];


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

