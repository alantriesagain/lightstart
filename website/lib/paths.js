/**
 * The site's URL shape, and the walking order of the catalogue: every
 * component in category order, alphabetical within a category.
 */

/** @import { ShowcaseCategoryListing } from "@bootstrapp/showcase/types.ts" */

/** @typedef {{ category: string, name: string }} ComponentRef */

export const COMPONENTS_PATH = "/components";
export const BUILT_WITH_LIGHT_PATH = "/built-with-light";

export const GITHUB_URL = "https://github.com/alantriesagain/light";
export const README_URL = `${GITHUB_URL}#readme`;
export const NPM_URL = "https://www.npmjs.com/package/@lightstart/light";

/** @param {string} category */
export const categoryPath = (category) => `${COMPONENTS_PATH}/${category}`;

/**
 * @param {string} category
 * @param {string} name
 */
export const componentPath = (category, name) => `${COMPONENTS_PATH}/${category}/${name}`;

/**
 * Every component the listings hold, in reading order.
 * @param {ShowcaseCategoryListing[]} listings
 * @returns {ComponentRef[]}
 */
export const walk = (listings) =>
  listings.flatMap((category) => category.components.map((name) => ({ category: category.id, name })));

/**
 * The component before and after the named one in reading order; null at
 * either end, and both null for a name the listings do not hold.
 * @param {ShowcaseCategoryListing[]} listings
 * @param {string} category
 * @param {string} name
 * @returns {{ previous: ComponentRef | null, next: ComponentRef | null }}
 */
export const neighbours = (listings, category, name) => {
  const flat = walk(listings);
  const at = flat.findIndex((entry) => entry.category === category && entry.name === name);
  if (at === -1) return { previous: null, next: null };
  return { previous: flat[at - 1] ?? null, next: flat[at + 1] ?? null };
};

/**
 * The category before and after the named one.
 * @param {ShowcaseCategoryListing[]} listings
 * @param {string} category
 * @returns {{ previous: ShowcaseCategoryListing | null, next: ShowcaseCategoryListing | null }}
 */
export const neighbourCategories = (listings, category) => {
  const at = listings.findIndex((entry) => entry.id === category);
  if (at === -1) return { previous: null, next: null };
  return { previous: listings[at - 1] ?? null, next: listings[at + 1] ?? null };
};
