/**
 * `@bootstrapp/light/theme/classes`: the utility classes a theme gives, as an atomic-CSS engine. Pure and
 * isomorphic: no DOM, no globals, the same modules compile classes in the
 * browser runtime and in the Node build, so dev and prod cannot drift.
 */

import { parseClass } from "./parse.js";
import { createRules } from "./rules.js";
import { createVariantApplier } from "./variants.js";
import { stringify } from "./stringify.js";
import { buildTheme } from "./scales.js";

/** @import { Engine, EngineOptions, CompiledRule } from "./types.ts" */

/**
 * @param {EngineOptions} [options]
 * @returns {Engine}
 */
export const createEngine = (options = {}) => {
  const theme = options.theme === undefined ? buildTheme() : options.theme;
  const safelist = options.safelist === undefined ? [] : options.safelist;
  const rules = createRules(theme);
  const applyVariants = createVariantApplier(theme.screens);
  const memo = new Map();

  /** @type {(cls: string) => CompiledRule|null} */
  const compile = (cls) => {
    if (memo.has(cls)) return memo.get(cls);
    const compiled = compileFresh(cls);
    memo.set(cls, compiled);
    return compiled;
  };

  /** @param {string} cls */
  const compileFresh = (cls) => {
    const parsed = parseClass(cls);
    if (!parsed) return null;
    const matched = rules.match(parsed);
    if (!matched) return null;
    const applied = applyVariants(parsed.variants, cls);
    if (!applied) return null;
    return {
      cls,
      selector: matched.childSelector !== null ? applied.selector + matched.childSelector : applied.selector,
      medias: applied.medias,
      weight: applied.weight,
      decls: matched.decls,
      order: matched.order,
      important: parsed.important,
      keyframes: matched.keyframes === null ? undefined : matched.keyframes,
    };
  };

  /** @param {Iterable<string>} [classes] */
  const generate = (classes = []) => {
    const matched = [];
    const unknown = [];
    const compiled = [];
    const seen = new Set();
    for (const cls of [...safelist, ...classes]) {
      if (seen.has(cls)) continue;
      seen.add(cls);
      const rule = compile(cls);
      if (rule) {
        matched.push(cls);
        compiled.push(rule);
      } else unknown.push(cls);
    }
    return { css: stringify(compiled), matched, unknown };
  };

  return { compile, generate, stringify, theme };
};

export { buildTheme, themeColorVariables, isColorValue, DEFAULT_THEME, FRAMEWORK_COLORS } from "./scales.js";
export { PREFLIGHT } from "./preflight.js";
export { parseClass } from "./parse.js";
export { escapeSelector } from "./variants.js";
export { stringify } from "./stringify.js";
