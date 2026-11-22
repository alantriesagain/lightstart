/**
 * The meta tags of an HTML page, keyed by their `property` or `name`: what a
 * fetched maps page says about its place in its OpenGraph and Twitter tags.
 */

import { decodeEntities } from "@lightstart/light/html/tokenizer.js";

const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/**
 * A tag's attributes, lowercased by name, as written.
 * @param {string} tag
 * @returns {Map<string, string>}
 */
const attributesOf = (tag) => {
  /** @type {Map<string, string>} */
  const attributes = new Map();
  for (const match of tag.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
};

/**
 * The page's meta tags, keyed by their `property` (else `name`), the first
 * one winning when a key repeats.
 * @param {string} html
 * @returns {Map<string, string>}
 */
export const metaTags = (html) => {
  /** @type {Map<string, string>} */
  const tags = new Map();
  if (typeof html !== "string") return tags;
  for (const [tag] of html.matchAll(META_TAG)) {
    const attributes = attributesOf(tag);
    const key = (attributes.get("property") ?? attributes.get("name") ?? "").trim().toLowerCase();
    const content = attributes.get("content");
    if (key === "" || content === undefined || tags.has(key)) continue;
    tags.set(key, decodeEntities(content));
  }
  return tags;
};
