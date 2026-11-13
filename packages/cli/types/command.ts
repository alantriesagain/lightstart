/**
 * @file A command's argument schema and the record it resolves to. A command is a plain record
 * so a static table of them compiles, and `defineCommand` is an identity that keeps the literal's
 * inferred argument types.
 */
import type { CommandContext } from "./context.ts";

export type ArgSpec =
  | { positional: true; required?: boolean; default?: string; description?: string; rest?: false }
  | { positional: true; rest: true; required?: boolean; description?: string }
  | { flag: true; short?: string; default?: boolean; description?: string }
  | {
      positional?: false;
      flag?: false;
      short?: string;
      default?: string;
      required?: boolean;
      choices?: readonly string[];
      description?: string;
    };

export type ArgsSchema = Record<string, ArgSpec>;

type ResolveArg<S extends ArgSpec> = S extends { flag: false }
  ? ResolveValue<S>
  : S extends { flag: boolean }
    ? boolean
    : ResolveValue<S>;

type ResolveValue<S extends ArgSpec> = S extends { rest: false }
  ? ResolveOption<S>
  : S extends { rest: boolean }
    ? string[]
    : ResolveOption<S>;

type ResolveOption<S extends ArgSpec> = S extends { choices: infer C extends readonly string[] }
  ? C[number]
  : S extends { required: false }
    ? S extends { default: string } ? string : string | undefined
    : S extends { required: boolean } | { default: string }
      ? string
      : string | undefined;

export type ResolvedArgs<S extends ArgsSchema> = {
  [K in keyof S]: ResolveArg<S[K]>;
};

export type Command<S extends ArgsSchema = ArgsSchema> = {
  description: string;
  usage?: string;
  hidden?: boolean;
  aliases?: readonly string[];
  args?: S;
  run(ctx: CommandContext, args: ResolvedArgs<S>): Promise<number | void> | number | void;
};

/** Identity wrapper that keeps a command literal's argument types. */
export const defineCommand = <const S extends ArgsSchema>(cmd: Command<S>): Command<S> => cmd;
