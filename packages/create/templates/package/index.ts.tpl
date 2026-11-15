/**
 * @file __NAME__: one small module. `slugify` turns text into a URL-safe slug, and `Slugger`
 * answers unique slugs across calls by numbering the ones it has already given out.
 */

/**
 * Turn text into a URL-safe slug: fold accents off, lowercase, replace every run of characters
 * that is not a letter or a digit with one hyphen, and trim the ends.
 *
 * @param text The text to slug.
 * @returns The slug, or the empty string when the text holds no letter or digit.
 */
export const slugify = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A slugger that remembers what it has answered, so a second `hello-world` becomes
 * `hello-world-2`.
 */
export class Slugger {
  private seen: Map<string, number>;

  /** Start a slugger with no slugs given out yet. */
  constructor() {
    this.seen = new Map();
  }

  /**
   * The slug for `text`, suffixed with `-2`, `-3`, … when an earlier call already took it.
   *
   * @param text The text to slug.
   * @returns A slug this slugger has not answered before.
   */
  slug(text: string): string {
    const base = slugify(text);
    const count = this.seen.get(base) ?? 0;
    this.seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${String(count + 1)}`;
  }
}
