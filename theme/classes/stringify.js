/**
 * Deterministic CSS emission: rules sorted by (media bucket, table order,
 * class name), one @media block per query combination, minified single-line
 * declarations. The same function serializes the dev runtime sheet and the
 * prod style.css, so both environments emit byte-identical output for the
 * same class set.
 */

/** @import { CompiledRule } from "./types.ts" */

/**
 * @param {CompiledRule[]} rules
 * @returns {string}
 */
export const stringify = (rules) => {
  /** @type {Map<string, { weight: number, rules: CompiledRule[] }>} */
  const groups = new Map();
  /** @type {Set<string>} */
  const keyframes = new Set();
  for (const rule of rules) {
    if (rule.keyframes) keyframes.add(rule.keyframes);
    const key = rule.medias.join(" and ");
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { weight: rule.weight, rules: [] }));
    group.weight = Math.max(group.weight, rule.weight);
    group.rules.push(rule);
  }

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    if (a[0] === "") return -1;
    if (b[0] === "") return 1;
    return a[1].weight - b[1].weight || (a[0] < b[0] ? -1 : 1);
  });

  const out = [...Array.from(keyframes).sort()];
  for (const [media, group] of sortedGroups) {
    group.rules.sort((/** @type {CompiledRule} */ a, /** @type {CompiledRule} */ b) => a.order - b.order || (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0));
    const body = group.rules.map((/** @type {CompiledRule} */ rule) => {
      const decls = rule.important
        ? rule.decls.map((/** @type {string} */ d) => `${d} !important`).join(";")
        : rule.decls.join(";");
      return `${rule.selector}{${decls}}`;
    });
    if (media === "") out.push(...body);
    else out.push(`@media ${media}{${body.join("")}}`);
  }
  return out.join("\n");
};
