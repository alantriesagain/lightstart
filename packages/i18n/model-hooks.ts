/**
 * Per-locale model hooks: a slug made unique within a locale, a canonical id
 * that links a record's translation variants, and publishing fields synced
 * across those variants.
 */

import { slugify } from "@lightstart/light/model/slug";
import { currentI18n } from "./current.ts";
import type { HookContext, ModelHooks, Row, Store } from "@lightstart/light/model";

/** The language a write is in: the one `configureI18n`'s instance is reading now. */
const contextLocale = (_ctx: HookContext): string => currentI18n().getLanguage();

const sourceOf = (data: Row, field: string): string | null => {
  const value = data[field];
  if (value === undefined || value === null || value === "") return null;
  return String(value);
};

/**
 * Opaque, time-sortable id used to link i18n translation variants of
 * the same conceptual record across locales.
 */
export const generateCanonicalId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/**
 * Locale-scoped slug variant of `generateUniqueSlug`: uniqueness is
 * checked only within the given locale.
 */
export const generateUniqueSlugForLocale = async (
  store: Store,
  model: string,
  slugField: string,
  value: string,
  locale: string,
  excludeId: unknown = null,
): Promise<string> => {
  const base = slugify(value);
  if (!base) return "";

  if (store.supportsOperator?.(model, "like")) {
    const taken = await store.getAll(model, { where: { [slugField]: { like: base }, locale } });
    const slugRegex = new RegExp(`^${base}(-\\d+)?$`);
    const takenSlugs: Set<string> = new Set(
      taken
        .filter((r) => r.id !== excludeId && typeof r[slugField] === "string" && slugRegex.test(r[slugField] as string))
        .map((r) => r[slugField] as string),
    );
    let candidate = base;
    let suffix = 0;
    while (takenSlugs.has(candidate)) {
      suffix++;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  let candidate = base;
  let suffix = 0;
  while (true) {
    const existing = await store.getAll(model, { where: { [slugField]: candidate, locale }, limit: 1 });

    if (!existing.length || existing[0].id === excludeId) return candidate;

    suffix++;
    candidate = `${base}-${suffix}`;
  }
};

const storeOf = (ctx: HookContext): Store => ctx.store;

/**
 * Per-locale slug + canonical-id hooks. On add, sets `locale`, generates a
 * locale-scoped unique slug, and uses the slug as the canonical id.
 */
export const i18nSlugHooks = (sourceField = "name", slugField = "slug"): ModelHooks => ({
  beforeAdd: async (data: Row, ctx: HookContext): Promise<Row> => {
    const declared = typeof data.locale === "string" ? data.locale : "";
    const locale = declared || contextLocale(ctx);
    data.locale = locale;

    const source = sourceOf(data, sourceField);
    if (!data[slugField] && source)
      data[slugField] = await generateUniqueSlugForLocale(storeOf(ctx), ctx.model, slugField, source, locale);

    if (!data.canonicalId && data[slugField]) data.canonicalId = data[slugField];

    return data;
  },

  beforeEdit: async (data: Row, ctx: HookContext): Promise<Row> => {
    const existing = await storeOf(ctx).get(ctx.model, data.id ?? null);
    const stored = existing?.locale;
    const declared = data.locale;
    const locale = typeof stored === "string" ? stored : typeof declared === "string" ? declared : "";

    const source = sourceOf(data, sourceField);
    if (source && !data[slugField] && locale)
      data[slugField] = await generateUniqueSlugForLocale(
        storeOf(ctx),
        ctx.model,
        slugField,
        source,
        locale,
        data.id,
      );

    return data;
  },
});

/** Rows a publishing sync is already touching, so a nested edit cannot recurse. */
const syncInProgress: Set<string> = new Set();

/**
 * Hook that propagates `status` / `publishedAt` / `scheduledAt` changes
 * across all locale variants sharing the same canonical id.
 */
export const i18nPublishingHooks = (): ModelHooks => ({
  afterEdit: async (result: Row, ctx: HookContext): Promise<Row> => {
    if (!result.canonicalId || result.status === undefined) return result;

    const syncKey = `${ctx.model}:${String(result.canonicalId)}`;
    if (syncInProgress.has(syncKey)) return result;

    try {
      syncInProgress.add(syncKey);

      const translations = await storeOf(ctx).getAll(ctx.model, {
        where: { canonicalId: result.canonicalId },
      });

      const updates: Array<Promise<Row>> = translations
        .filter((t) => t.id !== result.id)
        .map((translation) => {
          const patch: Row = { status: result.status };
          if (result.publishedAt !== undefined) patch.publishedAt = result.publishedAt;
          if (result.scheduledAt !== undefined) patch.scheduledAt = result.scheduledAt;

          return storeOf(ctx).edit(ctx.model, translation.id as string | number, patch);
        });

      await Promise.all(updates);
    } finally {
      syncInProgress.delete(syncKey);
    }

    return result;
  },
});

/**
 * Combined hooks: slug + publish-state sync. Use in `$hooks` on a model that
 * wants both locale-scoped slugs and cross-locale publishing.
 */
export const createI18nHooks = (sourceField = "name", slugField = "slug"): ModelHooks => {
  const slugHooks = i18nSlugHooks(sourceField, slugField);
  const publishHooks = i18nPublishingHooks();

  return {
    beforeAdd: slugHooks.beforeAdd,
    beforeEdit: slugHooks.beforeEdit,
    afterEdit: async (result: Row, ctx: HookContext): Promise<Row> => {
      if (publishHooks.afterEdit) await publishHooks.afterEdit(result, ctx);
      return result;
    },
  };
};

export default {
  generateCanonicalId,
  generateUniqueSlugForLocale,
  i18nSlugHooks,
  i18nPublishingHooks,
  createI18nHooks,
};
