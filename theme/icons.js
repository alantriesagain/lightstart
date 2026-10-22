/**
 * @file @bootstrapp/light/theme/icons.js
 * Icon sets in the `@iconify-json` shape, and where a page reads one icon
 * from. Nothing is fetched until the page says where icons come from:
 * `configureIcons({ load: iconify("lucide") })` reads them from the public
 * Iconify API, and a host that serves icons itself passes its own `load`.
 */

/** @import { IconCollection, IconEntry, IconSource } from "./types.ts" */

export const DEFAULT_SET = "lucide";

/**
 * One icon of a collection, with the collection's sizes filled in; aliases
 * resolve to their parent. Null when the set has no such name.
 * @type {(collection: IconCollection, name: string) => IconEntry | null}
 */
export const icon = (collection, name) => {
  const entry = collection.icons[name] ?? collection.icons[collection.aliases?.[name]?.parent ?? ""];
  if (!entry) return null;
  return {
    body: entry.body,
    width: entry.width ?? collection.width ?? 24,
    height: entry.height ?? collection.height ?? 24,
  };
};

/**
 * Every name the set answers to, aliases included, deprecated ones left out.
 * @type {(collection: IconCollection) => string[]}
 */
export const iconNames = (collection) => [
  ...Object.keys(collection.icons).filter((name) => !collection.icons[name].hidden),
  ...Object.keys(collection.aliases ?? {}),
].sort();

/**
 * A loader that reads each icon of `set` from the public Iconify API.
 * @param {string} [set]
 * @returns {(name: string) => Promise<IconEntry | null>}
 */
export const iconify = (set = DEFAULT_SET) => async (name) => {
  const response = await fetch(`https://api.iconify.design/${set}.json?icons=${name}`);
  if (!response.ok) return null;
  const collection = await response.json().catch(() => null);
  const icons = collection && typeof collection === "object" && "icons" in collection ? collection.icons : null;
  return icons && typeof icons === "object" ? icon(/** @type {IconCollection} */ (collection), name) : null;
};

/** @type {IconSource} */
export const icons = { load: null };

/**
 * Say where icons come from: a `load(name)` answering one icon, or `null`
 * when the page's stylesheet has every icon already.
 * @param {Partial<IconSource>} options
 */
export const configureIcons = (options) => {
  Object.assign(icons, options);
};
