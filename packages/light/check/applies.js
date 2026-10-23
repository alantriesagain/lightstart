/** Whether a rule applies to a project, from its `appliesTo` gate. */

/** @import { CheckRule, ProjectModel } from "./types.ts" */

/**
 * `null` when the rule applies; otherwise the reason it does not, with a
 * warning when the gate itself failed.
 * @template {ProjectModel} M
 * @param {CheckRule<M>} rule
 * @param {M} ctx
 * @returns {{ reason: string, warning?: string } | null}
 */
export const ruleApplies = (rule, ctx) => {
  const applies = rule.appliesTo;
  if (!applies) return null;
  if (applies.styling && applies.styling !== ctx.styling) return { reason: `${applies.styling}-only` };
  if (applies.dep && !ctx.hasDep(applies.dep)) return { reason: `needs @bootstrapp/${applies.dep}` };
  if (applies.when)
    try {
      if (!applies.when(ctx)) return { reason: "config-gated" };
    } catch (e) {
      return { reason: "when() threw", warning: `appliesTo.when threw: ${e instanceof Error ? e.message : e}` };
    }
  return null;
};
