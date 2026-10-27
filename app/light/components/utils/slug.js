/**
 * A heading's id from its text, and a slugger that keeps ids unique within
 * one document. Pure.
 */

/** @param {string} text */
export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A `slug(text)` that answers `text-2`, `text-3` for a repeat. */
export const createSlugger = () => {
  /** @type {Map<string, number>} */
  const seen = new Map();
  return (/** @type {string} */ text) => {
    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
};
