/** @import { HookContext, RowReader } from "./types.ts" */

/**
 * URL-friendly slug from arbitrary text: lowercase, ASCII-folded,
 * non-alphanumerics collapsed to single hyphens.
 *
 * @param {unknown} str
 * @returns {string}
 */
export const slugify = (str) => {
  if (!str || typeof str !== "string") return "";

  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
};

/**
 * @param {Set<string>} takenSlugs
 * @param {string} base
 * @returns {string}
 */
const probeCandidate = (takenSlugs, base) => {
  let candidate = base;
  let suffix = 0;
  while (takenSlugs.has(candidate)) {
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
};

/**
 * Find a slug derived from `value` that isn't already taken in `model`
 * for `field`. Uses the store's `like` operator when its adapter has one,
 * otherwise probes candidates sequentially.
 *
 * @param {RowReader & { supportsOperator?(model: string, operator: string): boolean }} store
 * @param {string} model
 * @param {string} field
 * @param {string} value
 * @param {unknown} [excludeId]
 * @returns {Promise<string>}
 */
export const generateUniqueSlug = async (store, model, field, value, excludeId = null) => {
  const base = slugify(value);
  if (!base) return "";

  if (store.supportsOperator?.(model, "like")) {
    const taken = /** @type {{ id?: unknown, [k: string]: unknown }[]} */ (
      await store.getAll(model, { where: { [field]: { like: base } } })
    );
    const slugRegex = new RegExp(`^${base}(-\\d+)?$`);
    /** @type {Set<string>} */
    const takenSlugs = new Set(
      taken
        .filter((r) => r.id !== excludeId && slugRegex.test(/** @type {string} */ (r[field])))
        .map((r) => /** @type {string} */ (r[field])),
    );
    return probeCandidate(takenSlugs, base);
  }

  let candidate = base;
  let suffix = 0;
  while (true) {
    const existing = /** @type {{ id?: unknown }[]} */ (
      await store.getAll(model, { where: { [field]: candidate }, limit: 1 })
    );

    if (!existing.length || existing[0].id === excludeId)
      return candidate;

    suffix++;
    candidate = `${base}-${suffix}`;
  }
};

/**
 * Convenience model hooks that auto-generate a slug from a source
 * field. Use in `$hooks` on the model schema.
 *
 *     export default {
 *       title: T.string({ required: true }),
 *       slug:  T.string(),
 *       $hooks: slugHooks("title", "slug"),
 *     };
 *
 * @param {string} [sourceField]
 * @param {string} [slugField]
 */
export const slugHooks = (sourceField = "name", slugField = "slug") => ({
  /**
   * @param {Record<string, unknown>} data
   * @param {HookContext} ctx
   */
  beforeAdd: async (data, { model, store }) => {
    if (!data[slugField] && data[sourceField])
      data[slugField] = await generateUniqueSlug(
        store, model, slugField, /** @type {string} */ (data[sourceField]),
      );

    return data;
  },
  /**
   * @param {Record<string, unknown>} data
   * @param {HookContext} ctx
   */
  beforeEdit: async (data, { model, store }) => {
    if (data[sourceField] && !data[slugField])
      data[slugField] = await generateUniqueSlug(
        store, model, slugField, /** @type {string} */ (data[sourceField]), data.id,
      );

    return data;
  },
});

export default { slugify, generateUniqueSlug, slugHooks };
