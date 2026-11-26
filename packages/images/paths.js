/**
 * @file Pure path helpers for image variants: browser- and node-safe.
 *
 * A variant of `photo.jpg` is a sibling file named with a suffix before the
 * extension: `photo_thumb.jpg`, `photo_og.jpg`, … The convention lives here so
 * every producer (normalizer, upload paths) and consumer (pins, cards, meta
 * tags) derives the same URL instead of storing it.
 */

/**
 * `foo.jpg` + `thumb` → `foo_thumb.jpg`; empty or extension-less input → "".
 * @param {string | null | undefined} src
 * @param {string} suffix
 * @returns {string}
 */
export const variantUrl = (src, suffix) => {
  if (!src || typeof src !== "string") return "";
  const i = src.lastIndexOf(".");
  if (i <= 0 || i <= src.lastIndexOf("/")) return "";
  return `${src.slice(0, i)}_${suffix}${src.slice(i)}`;
};

/**
 * The square thumbnail variant of a photo.
 * @param {string | null | undefined} src
 * @returns {string}
 */
export const thumbUrl = (src) => variantUrl(src, "thumb");

/**
 * True when a path names a variant with the given suffix.
 * @param {string | null | undefined} path
 * @param {string} suffix
 * @returns {boolean}
 */
export const isVariant = (path, suffix) => new RegExp(`_${suffix}\\.[a-z0-9]+$`, "i").test(path || "");
