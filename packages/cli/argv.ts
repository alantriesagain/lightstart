/**
 * @file The argument parser behind every command: long options with `=` or a following value,
 * `--no-` negation for flags, one-letter shorts that group (`-wo`) and take their value attached
 * (`-p3000`) or next, `--` ending the options, and positionals by declaration order, the last of
 * which may take the rest. A token the schema does not describe is an error, so a typo never runs
 * as if it were the default. Values are collected in a map and made into the result record once,
 * so no write uses a computed key.
 */
import type { ArgsSchema, ResolvedArgs } from "./types/command.ts";

export class ArgError extends Error {}

/** A command's args schema contradicts itself: raised when the schema is read, before any argv is looked at. */
export class SchemaError extends Error {}

type Spec = {
  positional?: boolean;
  rest?: boolean;
  flag?: boolean;
  short?: string;
  default?: string | boolean;
  required?: boolean;
  choices?: readonly string[];
};

const validateSchema = (schema: Record<string, unknown>): void => {
  const shorts = new Map<string, string>();
  const keys = Object.keys(schema);
  for (const [key, raw] of Object.entries(schema)) {
    const spec = raw as Spec;
    if (spec.required && spec.default !== undefined) throw new SchemaError(`"${key}" is required and has a default; one or the other`);
    if (spec.choices && typeof spec.default === "string" && !spec.choices.includes(spec.default))
      throw new SchemaError(`"${key}" defaults to "${spec.default}", which is not one of its choices: ${spec.choices.join(", ")}`);
    if (spec.short !== undefined) {
      if (spec.short.length !== 1) throw new SchemaError(`"${key}" has the short "-${spec.short}"; a short is one character`);
      const taken = shorts.get(spec.short);
      if (taken) throw new SchemaError(`"${key}" and "${taken}" share the short "-${spec.short}"`);
      shorts.set(spec.short, key);
    }
    if (spec.rest && !spec.positional) throw new SchemaError(`"${key}" takes the rest but is not positional`);
    if (spec.rest) {
      let last = "";
      for (const other of keys) if ((schema[other] as Spec).positional) last = other;
      if (last !== key) throw new SchemaError(`"${key}" takes the rest, so it must be the last positional`);
    }
  }
};

const validateChoice = (key: string, value: string, spec: Spec): void => {
  if (spec.choices && !spec.choices.includes(value))
    throw new ArgError(`Invalid value for --${key}: "${value}". Expected one of: ${spec.choices.join(", ")}`);
};

/** Parse `argv` against `schema`, answering the resolved arguments. */
export const parseArgs = <const S extends ArgsSchema>(schema: S, argv: readonly string[]): ResolvedArgs<S> => {
  validateSchema(schema);
  const specs: Record<string, unknown> = schema;
  const values = new Map<string, unknown>();
  const positionals: string[] = [];
  const positionalKeys: string[] = [];
  const shortMap = new Map<string, string>();

  for (const [key, raw] of Object.entries(specs)) {
    const spec = raw as Spec;
    if (spec.positional) positionalKeys.push(key);
    else if (spec.short) shortMap.set(spec.short, key);
    if (spec.flag) values.set(key, spec.default ?? false);
    else if (!spec.positional && spec.default !== undefined) values.set(key, spec.default);
  }

  const setOption = (key: string, value: string | undefined, display: string): void => {
    if (value === undefined) throw new ArgError(`Option ${display} requires a value`);
    validateChoice(key, value, specs[key] as Spec);
    values.set(key, value);
  };

  let i = 0;
  while (i < argv.length) {
    const token = argv[i]!;

    if (token === "--") {
      for (let at = i + 1; at < argv.length; at++) positionals.push(argv[at]!);
      break;
    }

    if (token.startsWith("--no-") && !(token.slice(2) in specs)) {
      const key = token.slice(5);
      if (!(key in specs)) throw new ArgError(`Unknown flag: --no-${key}`);
      if (!(specs[key] as Spec).flag) throw new ArgError(`--no-${key} can only negate a flag`);
      values.set(key, false);
      i++;
      continue;
    }

    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const key = eq === -1 ? token.slice(2) : token.slice(2, eq);
      if (!(key in specs) || (specs[key] as Spec).positional) throw new ArgError(`Unknown option: --${key}`);
      if ((specs[key] as Spec).flag) {
        if (eq !== -1) throw new ArgError(`--${key} is a flag and takes no value`);
        values.set(key, true);
      } else {
        const value = eq === -1 ? argv[++i] : token.slice(eq + 1);
        setOption(key, value, `--${key}`);
      }
      i++;
      continue;
    }

    if (token.startsWith("-") && token.length > 1 && !/^-\d/.test(token)) {
      const cluster = token.slice(1);
      for (let c = 0; c < cluster.length; c++) {
        const short = cluster[c]!;
        const key = shortMap.get(short);
        if (!key) throw new ArgError(`Unknown short option: -${short}`);
        if ((specs[key] as Spec).flag) {
          values.set(key, true);
          continue;
        }
        const attached = cluster.slice(c + 1);
        setOption(key, attached || argv[++i], `-${short}`);
        break;
      }
      i++;
      continue;
    }

    positionals.push(token);
    i++;
  }

  for (let p = 0; p < positionalKeys.length; p++) {
    const key = positionalKeys[p]!;
    const spec = specs[key] as Spec;
    if (spec.rest) {
      const rest = positionals.slice(p);
      values.set(key, rest);
      if (!positionals[p] && spec.required) throw new ArgError(`Missing required positional: ${key}`);
      positionals.length = p;
      break;
    }
    const value = positionals[p];
    if (value !== undefined) values.set(key, value);
    else if (spec.default !== undefined) values.set(key, spec.default);
    else if (spec.required) throw new ArgError(`Missing required positional: ${key}`);
  }
  if (positionals.length > positionalKeys.length) throw new ArgError(`Unexpected argument: ${positionals[positionalKeys.length]}`);

  for (const [key, raw] of Object.entries(specs)) {
    const spec = raw as Spec;
    if (spec.flag || spec.positional) continue;
    const value = values.get(key);
    if (spec.required && (value === undefined || value === null)) throw new ArgError(`Missing required option: --${key}`);
  }

  return Object.fromEntries(values) as ResolvedArgs<S>;
};
