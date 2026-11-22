/**
 * Google Maps and Apple Maps links, read without a network: the first such
 * link in shared text, what a link says about its place (the name and the
 * coordinates when the URL carries them, or that it is a short link to
 * resolve), and the preview a fetched maps page gives.
 *
 * @import { MapsLink, MapsPreview } from "./types.ts"
 */

import { decodeEntities } from "@lightstart/light/html/tokenizer.js";
import { metaTags } from "./lib/meta.js";

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[).,;:!?\]}'"»]+$/;
const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;
const APPLE_HOSTS = new Set(["maps.apple.com", "maps.apple"]);
const PAIR = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const PLACE_DATA = /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/;
const VIEW_CENTRE = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/;
const MAPS_SUFFIX = /\s*[·•|–—-]\s*(?:Google Maps|Apple Maps|Maps)\s*$/i;
const MAPS_ONLY = /^(?:Google Maps|Apple Maps|Maps)$/i;
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

/**
 * @param {string} text
 * @returns {string}
 */
const decodePart = (text) => {
  const spaced = text.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
};

/**
 * @param {string | undefined} lat
 * @param {string | undefined} lng
 * @returns {{ lat: number, lng: number } | null}
 */
const coords = (lat, lng) => {
  const a = Number(lat);
  const b = Number(lng);
  if (lat === undefined || lng === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
};

/**
 * @param {string | null | undefined} text
 * @returns {{ lat: number, lng: number } | null}
 */
const pairOf = (text) => {
  const match = text ? PAIR.exec(text) : null;
  return match ? coords(match[1], match[2]) : null;
};

/**
 * @param {string} name
 * @returns {string}
 */
const placeName = (name) => ((pairOf(name) || name.includes("°")) ? "" : name.trim());

/**
 * @param {string} raw
 * @returns {URL | null}
 */
const toUrl = (raw) => {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

/**
 * @param {URL} url
 * @returns {Omit<MapsLink, "provider" | "url"> | null}
 */
const readGoogle = (url) => {
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return { name: "", lat: null, lng: null, short: true };
  if (host === "goo.gl") return url.pathname.startsWith("/maps/") ? { name: "", lat: null, lng: null, short: true } : null;
  if (!GOOGLE_HOST.test(host)) return null;
  if (!host.startsWith("maps.") && !/^\/maps(?:\/|$)/.test(url.pathname)) return null;
  const path = url.pathname;
  const segment = /\/maps\/(?:place|search)\/([^/]+)/.exec(path)?.[1];
  const named = segment ? decodePart(segment) : "";
  const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
  const data = PLACE_DATA.exec(path + url.search);
  const centre = VIEW_CENTRE.exec(path);
  const position = (data && coords(data[1], data[2])) || pairOf(named) || pairOf(query) || (centre && coords(centre[1], centre[2]));
  return {
    name: placeName(named) || placeName(query),
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
    short: false,
  };
};

/**
 * @param {URL} url
 * @returns {Omit<MapsLink, "provider" | "url"> | null}
 */
const readApple = (url) => {
  if (!APPLE_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.pathname.startsWith("/p/")) return { name: "", lat: null, lng: null, short: true };
  const params = url.searchParams;
  const query = params.get("q") ?? "";
  const position = pairOf(params.get("ll")) || pairOf(params.get("coordinate")) || pairOf(query);
  return {
    name: placeName(query) || placeName(params.get("name") ?? "") || placeName(params.get("address") ?? ""),
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
    short: false,
  };
};

/**
 * What a Google Maps or Apple Maps URL says about its place: the provider,
 * the name, the coordinates of the place itself (a Google `!3d…!4d…` pair
 * before the `@` view centre), and `short` for a link that only resolving it
 * can read. Null for any other URL.
 * @param {string} url
 * @returns {MapsLink | null}
 */
export const parseMapsLink = (url) => {
  const parsed = typeof url === "string" ? toUrl(url) : null;
  if (!parsed) return null;
  const google = readGoogle(parsed);
  if (google) return { provider: "google", url: url.trim(), ...google };
  const apple = readApple(parsed);
  return apple ? { provider: "apple", url: url.trim(), ...apple } : null;
};

/**
 * The first Google Maps or Apple Maps URL in free text, such as what a phone
 * shares from a maps app ("Place name\nhttps://maps.app.goo.gl/…"), or null.
 * @param {string} text
 * @returns {string | null}
 */
export const findMapsLink = (text) => {
  if (typeof text !== "string") return null;
  for (const [match] of text.matchAll(URL_IN_TEXT)) {
    const candidate = match.replace(TRAILING, "");
    if (parseMapsLink(candidate)) return candidate;
  }
  return null;
};

/**
 * @param {string} image
 * @returns {string}
 */
const absolute = (image) => (image.startsWith("//") ? `https:${image}` : image);

/**
 * @param {string} image
 * @returns {{ lat: number, lng: number } | null}
 */
const staticMapCentre = (image) => {
  const url = toUrl(image);
  if (!url || !/static|snapshot/i.test(url.pathname)) return null;
  for (const marker of url.searchParams.getAll("markers").reverse()) {
    const found = marker.split("|").map(pairOf).findLast(Boolean);
    if (found) return found;
  }
  return pairOf(url.searchParams.get("center"));
};

/**
 * @param {string} raw
 * @param {MapsLink | null} link
 * @returns {string}
 */
const titleOf = (raw, link) => {
  const title = raw.replace(MAPS_SUFFIX, "").trim();
  if (MAPS_ONLY.test(title)) return "";
  return link?.provider === "google" ? title.split(" · ")[0].trim() : title;
};

/**
 * The preview a fetched maps page gives: the title (its " · Google Maps"
 * style suffix gone, and on a Google page the " · address" after the name),
 * the image and the canonical URL from the OpenGraph and Twitter tags, and
 * the coordinates from the final URL, the page's own
 * `place:location` tags, or a static map image's `markers=` or `center=`.
 * @param {string} html
 * @param {string} finalUrl
 * @returns {MapsPreview}
 */
export const readPreview = (html, finalUrl) => {
  const page = typeof html === "string" ? html : "";
  const meta = metaTags(page);
  const fromTag = TITLE.exec(page)?.[1];
  const rawTitle = meta.get("og:title") || meta.get("twitter:title") || (fromTag ? decodeEntities(fromTag).trim() : "");
  const images = ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]
    .map((key) => meta.get(key))
    .filter((value) => typeof value === "string")
    .map(absolute);
  const url = meta.get("og:url") || finalUrl || "";
  const link = parseMapsLink(finalUrl || "");
  const position = (link?.lat != null && link.lng != null ? { lat: link.lat, lng: link.lng } : null)
    || coords(meta.get("place:location:latitude"), meta.get("place:location:longitude"))
    || images.map(staticMapCentre).find(Boolean)
    || null;
  return {
    title: titleOf(rawTitle, link),
    image: images[0] ?? "",
    url,
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
  };
};
