/** @import { SearchDoc } from "../types.js" */

/**
 * @param {SearchDoc[]} docs
 * @param {string} query
 * @param {number} limit
 */
export const matchDocs = (docs, query, limit) => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  /** @type {Map<string, number>} */
  const counts = new Map();
  return docs.filter((doc) => {
    if (!`${doc.title} ${doc.hint || ""}`.toLowerCase().includes(q))
      return false;
    const n = counts.get(doc.group) || 0;
    if (n >= limit) return false;
    counts.set(doc.group, n + 1);
    return true;
  });
};

/**
 * @param {SearchDoc[]} matches
 * @param {string[]} groups
 */
export const groupDocs = (matches, groups) => {
  const order = [...groups];
  for (const doc of matches)
    if (!order.includes(doc.group)) order.push(doc.group);
  return order
    .map((group) => ({ group, docs: matches.filter((d) => d.group === group) }))
    .filter((g) => g.docs.length);
};
