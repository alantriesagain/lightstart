/**
 * What node's `--trace-opt --trace-deopt` lines say, read back so the pages
 * can describe the captured run rather than a run that might have gone
 * otherwise: which function each optimizing compiler finished, and each
 * bailout with its reason. Pure.
 */

/** @param {string} target */
const tierOf = (target) => (target.startsWith("TURBOFAN") ? "TurboFan" : target === "MAGLEV" ? "Maglev" : target);

/** @param {string} name */
const functionOf = (name) => name || "top level";

/**
 * @param {string} trace
 * @returns {{ fn: string, tier: string, osr: boolean }[]}
 */
export const compilations = (trace) =>
  [...trace.matchAll(/^\[completed compiling <JSFunction ?([^>]*)> \(target (\w+)\)( OSR)?/gm)].map((match) => ({
    fn: functionOf(match[1]),
    tier: tierOf(match[2]),
    osr: Boolean(match[3]),
  }));

/**
 * @param {string} trace
 * @returns {{ fn: string, reason: string, from: string }[]}
 */
export const bailouts = (trace) =>
  [...trace.matchAll(/^\[bailout \(kind: [^,]+, reason: ([^)]+)\): begin\. deoptimizing <JSFunction ?([^>]*)>, <Code (\w+)>/gm)].map((match) => ({
    fn: functionOf(match[2]),
    reason: match[1].charAt(0).toLowerCase() + match[1].slice(1),
    from: tierOf(match[3]),
  }));

/**
 * The tiers one function reached, in order, without repeats: "Maglev, then TurboFan".
 * @param {{ fn: string, tier: string }[]} list
 * @param {string} fn
 */
export const tiersOf = (list, fn) => [...new Set(list.filter((entry) => entry.fn === fn).map((entry) => entry.tier))].join(", then ");

/** @param {string} fn */
const named = (fn) => (fn === "top level" ? "the module's top level (the function that contains the loop)" : `\`${fn}\``);

/**
 * What a captured run did, in sentences: which compilers compiled each
 * function (and whether it switched while running), then each deoptimization.
 * @param {string} trace
 */
export const describeRun = (trace) => {
  const run = compilations(trace);
  const compiled = [...new Set(run.map((entry) => entry.fn))].map(
    (fn) => `${named(fn)} with ${tiersOf(run, fn)}${run.some((entry) => entry.fn === fn && entry.osr) ? ", switching while it ran" : ""}`,
  );
  const deopts = bailouts(trace).map((b) => `${b.fn === "top level" ? "the top level's" : `${named(b.fn)}'s`} ${b.from} code (${b.reason})`);
  const story = `In this run, V8 compiled ${compiled.length > 1 ? `${compiled.slice(0, -1).join(", ")} and ${compiled.at(-1)}` : compiled[0]}.`;
  if (!deopts.length) return story;
  if (deopts.length === 1) return `${story} It deoptimized once: it discarded ${deopts[0]} and continued in bytecode.`;
  return `${story} It deoptimized ${deopts.length} times, discarding ${deopts.join(" and ")}, and each time continued in bytecode.`;
};
