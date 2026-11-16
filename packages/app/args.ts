/**
 * @file An app's arguments: the terminal host's `--data` and `--scheme` beside
 * the schema `src/app.ts` declares, and the values the parser resolves from
 * `argv`. A name the app declares wins over the host's.
 */

import { parseArgs } from "@lightstart/cli/argv.ts";
import type { ArgsSchema } from "@lightstart/cli/types/command.ts";

/** The arguments every terminal host understands. */
export const hostArgs: ArgsSchema = {
  data: { default: ".", description: "The folder that holds the JSONL files" },
  scheme: { choices: ["dark", "light"], default: "dark", description: "The theme's side" },
};

/** The app's schema with the host's arguments added, the app's own winning a name. */
export const argsSchemaOf = (config: { argsSchema?: ArgsSchema }): ArgsSchema => ({ ...hostArgs, ...(config.argsSchema ?? {}) });

/** Parse `argv` for the app: the host's arguments and the app's own. */
export const parseAppArgs = (config: { argsSchema?: ArgsSchema }, argv: readonly string[]): Record<string, unknown> =>
  parseArgs(argsSchemaOf(config), argv) as Record<string, unknown>;
