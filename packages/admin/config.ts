/**
 * @file The plain-data rules an admin config's per-tool settings keep: a
 * record of tools, each a record of settings that survive `JSON.stringify`
 * unchanged. A function, a symbol, `undefined`, a non-finite number or a class
 * instance (a `Date`, a `Map`) is not plain data and is refused by name.
 */

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const plainProblem = (value: unknown, at: string): string | null => {
  if (value === null) return null;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return null;
  if (kind === "number") return Number.isFinite(value) ? null : `${at} is not a finite number`;
  if (kind === "undefined") return `${at} is undefined`;
  if (kind === "function") return `${at} is a function`;
  if (kind === "symbol") return `${at} is a symbol`;
  if (kind === "bigint") return `${at} is a bigint`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const problem = plainProblem(value[i], `${at}[${String(i)}]`);
      if (problem !== null) return problem;
    }
    return null;
  }
  if (!isPlainRecord(value)) return `${at} is a class instance`;
  for (const key of Object.keys(value)) {
    const problem = plainProblem(value[key], `${at}.${key}`);
    if (problem !== null) return problem;
  }
  return null;
};

/** What is wrong with `tools`, or null when it is a record of plain-data records. */
export const toolsProblem = (tools: unknown): string | null => {
  if (!isPlainRecord(tools)) return "The admin tools must be a record of tool settings";
  for (const name of Object.keys(tools)) {
    const settings = tools[name];
    if (!isPlainRecord(settings)) return `The admin tool "${name}" settings must be a record`;
    for (const key of Object.keys(settings)) {
      const problem = plainProblem(settings[key], `The admin tool "${name}" setting "${key}"`);
      if (problem !== null) return problem;
    }
  }
  return null;
};

/** The tools config as plain data, throwing with what is wrong when it is not. */
export const validateTools = (tools: unknown): Record<string, Record<string, unknown>> => {
  const problem = toolsProblem(tools);
  if (problem !== null) throw new Error(problem);
  return tools as Record<string, Record<string, unknown>>;
};

/** The tools config, or `{}` when it does not survive the plain-data rules. */
export const toolsOf = (tools: unknown): Record<string, Record<string, unknown>> => {
  try {
    return validateTools(tools);
  } catch {
    return {};
  }
};
