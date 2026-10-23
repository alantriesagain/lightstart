/** @import { CheckRule, ProjectModel } from "./types.ts" */

/**
 * Typed identity wrapper for check rules. The rule id is derived from the
 * owning package short name + file basename, never declared in the file. A
 * host binds `M` to its own project model.
 *
 * @template {ProjectModel} [M=ProjectModel]
 * @param {CheckRule<M>} rule
 * @returns {CheckRule<M>}
 */
export const defineRule = (rule) => rule;

const RULE_KEYS = new Set(["severity", "description", "why", "appliesTo", "check"]);
const APPLIES_KEYS = new Set(["styling", "dep", "when"]);

/** @param {unknown} rule @returns {string | null} problem description, or null if valid */
export const validateRuleShape = (rule) => {
  if (!rule || typeof rule !== "object") return "default export is not an object";
  const r = /** @type {Record<string, unknown>} */ (rule);
  for (const key of Object.keys(r)) if (!RULE_KEYS.has(key)) return `unknown key "${key}", typo?`;
  if (r.severity !== "error" && r.severity !== "warn") return `invalid severity "${r.severity}" (expected "error" or "warn")`;
  if (typeof r.description !== "string" || !r.description) return "missing description";
  if (r.why !== undefined && (typeof r.why !== "string" || !r.why)) return "why must be a non-empty string";
  if (typeof r.check !== "function") return "missing check() function";
  if (r.appliesTo !== undefined) {
    if (!r.appliesTo || typeof r.appliesTo !== "object") return "appliesTo must be an object";
    const applies = /** @type {Record<string, unknown>} */ (r.appliesTo);
    for (const key of Object.keys(applies)) if (!APPLIES_KEYS.has(key)) return `unknown appliesTo key "${key}" (styling | dep | when)`;
    if (applies.styling !== undefined && applies.styling !== "css" && applies.styling !== "tailwind") return `invalid appliesTo.styling "${applies.styling}" (css | tailwind)`;
    if (applies.dep !== undefined && (typeof applies.dep !== "string" || !applies.dep)) return "appliesTo.dep must be a package short name";
    if (applies.when !== undefined && typeof applies.when !== "function") return "appliesTo.when must be a function";
  }
  return null;
};
