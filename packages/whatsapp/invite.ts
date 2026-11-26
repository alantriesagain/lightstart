/**
 * @file A WhatsApp group's invite page read as a link preview, the way a shared
 * maps link is read: the page a shell fetched from `chat.whatsapp.com/<code>`
 * names the group in `og:title` and shows its photo in `og:image`, to any user
 * agent. A revoked or expired invite answers with no title and WhatsApp's own
 * logo, which is how it reads as dead.
 */

import { decodeEntities } from "@lightstart/light/html/tokenizer.js";

import { isGroupPhoto } from "./client.ts";
import type { GroupInvite } from "./server/types.ts";

const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** A tag's attributes, lowercased by name, the first occurrence winning. */
const attributesOf = (tag: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? "").toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
};

/** The page's meta tags, keyed by their `property` (else `name`), the first one winning. */
const metaTags = (html: string): Map<string, string> => {
  const tags = new Map<string, string>();
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

/**
 * The group an invite page names: its name, its photo when WhatsApp serves one
 * from the photo host, and `dead` for a page that names no group.
 *
 * @param html the invite page as fetched
 * @returns the group's name, photo and whether it is dead
 */
export const readInvite = (html: string): GroupInvite => {
  const meta = metaTags(html);
  const name = meta.get("og:title") ?? "";
  const photo = meta.get("og:image") ?? "";
  return { name, image: name && isGroupPhoto(photo) ? photo : "", dead: !name };
};
