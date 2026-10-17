import type { HookContext, Row, RowReader } from "./types.ts";

/**
 * URL-friendly slug from arbitrary text: lowercase, ASCII-folded,
 * non-alphanumerics collapsed to single hyphens.
 */
export const slugify = (str: unknown): string => {
  if (!str || typeof str !== "string") return "";

  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
};

const probeCandidate = (takenSlugs: Set<string>, base: string): string => {
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
 */
export const generateUniqueSlug = async (
  store: RowReader & { supportsOperator?(model: string, operator: string): boolean },
  model: string,
  field: string,
  value: string,
  excludeId: unknown = null,
): Promise<string> => {
  const base = slugify(value);
  if (!base) return "";

  if (store.supportsOperator?.(model, "like")) {
    const taken = await store.getAll(model, { where: { [field]: { like: base } } });
    const slugRegex = new RegExp(`^${base}(-\\d+)?$`);
    const takenSlugs: Set<string> = new Set(
      taken
        .filter((r) => r.id !== excludeId && slugRegex.test(r[field] as string))
        .map((r) => r[field] as string),
    );
    return probeCandidate(takenSlugs, base);
  }

  let candidate = base;
  let suffix = 0;
  while (true) {
    const existing = await store.getAll(model, { where: { [field]: candidate }, limit: 1 });

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
 */
export const slugHooks = (sourceField = "name", slugField = "slug") => ({
  beforeAdd: async (data: Row, { model, store }: HookContext): Promise<Row> => {
    if (!data[slugField] && data[sourceField])
      data[slugField] = await generateUniqueSlug(
        store, model, slugField, data[sourceField] as string,
      );

    return data;
  },
  beforeEdit: async (data: Row, { model, store }: HookContext): Promise<Row> => {
    if (data[sourceField] && !data[slugField])
      data[slugField] = await generateUniqueSlug(
        store, model, slugField, data[sourceField] as string, data.id,
      );

    return data;
  },
});

export default { slugify, generateUniqueSlug, slugHooks };
