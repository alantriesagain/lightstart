/**
 * @file The extensions a package adds to a command: extra arguments merged into its schema and a
 * setup run when the command opens itself to extensions. A package widens `Extensions` by
 * declaration merging, as it does `Hooks`.
 */
import type { ArgsSchema, ResolvedArgs } from "./command.ts";
import type { CommandContext } from "./context.ts";

/** The commands a package may extend, and what each hands an extension. */
export interface Extensions {}

/**
 * The arguments each command hands an extension beside the extension's own. A package widens
 * `CommandArgs` by declaration merging, as it does `Extensions`.
 */
export interface CommandArgs {}

export type ExtensionApi<K extends keyof Extensions> = Extensions[K];

export type ExtensionSetup<K extends keyof Extensions, S extends ArgsSchema = ArgsSchema> = (
  ctx: CommandContext,
  args: ResolvedArgs<S> & (K extends keyof CommandArgs ? CommandArgs[K] : {}),
  api: ExtensionApi<K>,
) => Promise<void> | void;

export type Extension<K extends keyof Extensions = keyof Extensions, S extends ArgsSchema = ArgsSchema> = {
  args?: S;
  setup: ExtensionSetup<K, S>;
};

/** What an `cli/extend/<command>.ts` file default-exports. */
export type ExtensionDefinition<K extends keyof Extensions = keyof Extensions> = {
  command: K;
  args?: ArgsSchema;
  setup: ExtensionSetup<K>;
};

/** Keeps the command name, the setup's api and the extension's own arguments typed. */
export const defineExtension = <K extends keyof Extensions, const S extends ArgsSchema = ArgsSchema>(command: K, extension: Extension<K, S>): ExtensionDefinition<K> => ({
  command,
  args: extension.args,
  setup: extension.setup as unknown as ExtensionSetup<K>,
});
