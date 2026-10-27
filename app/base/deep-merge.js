/**
 * bootstrapp/base/deep-merge: recursive merge of two plain-object trees.
 *
 * Plain objects merge key by key, arrays and scalars replace, `override`
 * wins. Kept dependency-free so anything can reach it: app profiles refine
 * the manifest with it, and a package that carries a configuration block
 * layers a profile's version of that block over its own.
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * @param {unknown} base
 * @param {unknown} override
 * @returns {unknown}
 */
export const deepMerge = (base, override) => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override))
    merged[key] = key in merged ? deepMerge(merged[key], value) : value;
  return merged;
};
