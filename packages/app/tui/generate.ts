/**
 * @file The terminal host's part of the generation: `.light/main.ts`, which
 * runs the first run mode that matches (`src/modes/<name>.ts`, each imported
 * statically: `main(argv, context)` when its `matches(argv)` answers true,
 * or argv holds `--<name>`; `context.open()` opens the app's stores) and
 * otherwise starts the manifest with `@lightstart/app/tui`; and `.light/classes.baked.ts`, the theme's classes
 * the entry's views use baked into tables, one per scheme. The manifest
 * carries the root view's class, which the host makes.
 */

import { join } from "node:path";
import { bakeTables, collectClasses, render as renderClasses } from "@lightstart/light/theme/bake.js";
import defaultTheme from "@lightstart/light/theme/themes/default.js";
import { modelsSource, readModelDefinition } from "./models.ts";
import type { GenerationHelpers, HostGeneration } from "../node/generate.ts";

const modeImport = (helpers: GenerationHelpers, project: string, file: string, index: number): string =>
  `import * as mode${String(index)} from "${helpers.specifierFor(project, file)}";`;

const modeDispatch = (helpers: GenerationHelpers, file: string, index: number): string[] => {
  const name = helpers.nameOf(file);
  return [
    `const matches${String(index)} = Reflect.get(mode${String(index)}, "matches");`,
    "",
    `if (typeof matches${String(index)} === "function" ? (matches${String(index)} as (given: readonly string[]) => boolean)(argv) : argv.includes(${JSON.stringify(`--${name}`)})) {`,
    `  process.exit(await (mode${String(index)}.main as (given: readonly string[], context: ModeContext) => Promise<number>)(argv, new ModeContext(manifest, argv.filter((given) => given !== ${JSON.stringify(`--${name}`)}))));`,
    "}",
  ];
};

const mainSource = (helpers: GenerationHelpers, project: string, modes: string[]): string => {
  const lines: string[] = [modes.length > 0 ? 'import { ModeContext, start } from "@lightstart/app/tui";' : 'import { start } from "@lightstart/app/tui";', 'import manifest from "./app.ts";', 'import { dark, light } from "./classes.baked.ts";'];
  modes.forEach((file, index) => lines.push(modeImport(helpers, project, file, index)));
  if (modes.length > 0) {
    lines.push("", "const argv = process.argv.slice(2);", "");
    modes.forEach((file, index) => lines.push(...modeDispatch(helpers, file, index), ""));
  }
  lines.push("await start(manifest, { classes: { dark, light } });", "");
  return lines.join("\n");
};

const bakedSource = async (main: string): Promise<string> => {
  const ts = (await import("@lightstart/light/check/parse/typescript.js")).default;
  const found = collectClasses(main, ts);
  const baked = bakeTables(found.classes, defaultTheme, ["dark", "light"]);
  const problems = [...found.problems, ...baked.problems];
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return renderClasses(baked.tables, ".light/main.ts", "light classes:bake .light/main.ts -o .light/classes.baked.ts --scheme dark,light")
    .replace('/** @import { BakedEntry } from "@lightstart/light/theme/baked" */', 'import type { BakedEntry } from "@lightstart/light/theme/baked";')
    .replaceAll("/** @type {BakedEntry[]} */\n", "")
    .replace(/^export const (\w+) = \[$/gm, "export const $1: BakedEntry[] = [");
};

const generation: HostGeneration = {
  rootView: true,
  async write(project, dir, main, helpers) {
    const modes = helpers.flatFiles(join(project, "src", "modes"));
    const wroteMain = helpers.writeWhenChanged(main, mainSource(helpers, project, modes));
    const classes = join(dir, "classes.baked.ts");
    const wroteClasses = helpers.writeWhenChanged(classes, await bakedSource(main));
    const models = helpers.flatFiles(join(project, "src", "models"));
    const definitions = await Promise.all(models.map((file) => readModelDefinition(file, helpers.nameOf(file))));
    const wroteModels = helpers.writeWhenChanged(join(dir, "models.ts"), modelsSource(definitions));
    return { changed: wroteMain || wroteClasses || wroteModels, classes, modes: modes.map(helpers.nameOf) };
  },
};

export default generation;
