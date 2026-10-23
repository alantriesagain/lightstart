/**
 * Whether a router path is "at" a target: the target itself, or a page under
 * it unless the match is exact. The root matches only itself. Pure.
 */

/**
 * @param {string} path the router's current path
 * @param {string} target a path to compare against
 * @param {boolean} [exact]
 */
export const isActivePath = (path, target, exact = false) => {
  if (!target) return false;
  if (exact || target === "/") return path === target;
  return path === target || path.startsWith(`${target}/`);
};
