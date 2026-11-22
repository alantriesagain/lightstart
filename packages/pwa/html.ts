/**
 * @file The page tags and host headers a PWA build writes: the manifest link
 * and the theme colour. The generated entry registers the worker.
 */

import { normalizeBase, withBase } from "./base.ts";

/** What a page needs to become installable: the base, and the theme colour when the config names one. */
export interface PageTags {
  base: string;
  themeColor?: string;
}

const attr = (value: string): string => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** Put the manifest link and the theme colour into `html` before `</head>`. */
export const injectPwaTags = (html: string, tags: PageTags): string => {
  if (html.includes('rel="manifest"')) return html;
  const base = normalizeBase(tags.base);
  const lines: string[] = [`<link rel="manifest" href="${attr(withBase(base, "/manifest.webmanifest"))}">`];
  if (tags.themeColor !== undefined) lines.push(`<meta name="theme-color" content="${attr(tags.themeColor)}">`);
  const block = `${lines.join("\n")}\n`;
  const head = /<\/head\s*>/i.exec(html);
  if (head !== null) return `${html.slice(0, head.index)}${block}${html.slice(head.index)}`;
  const open = /<head[^>]*>/i.exec(html);
  if (open !== null) {
    const at = open.index + open[0].length;
    return `${html.slice(0, at)}\n${block}${html.slice(at)}`;
  }
  return `${block}${html}`;
};

const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Add `Cache-Control: no-cache` for the worker and the manifest to a `_headers` file. */
export const noCacheHeaders = (headers: string, base: string): string => {
  let result = headers;
  for (const path of [withBase(normalizeBase(base), "/sw.js"), withBase(normalizeBase(base), "/manifest.webmanifest")]) {
    if (new RegExp(`^${escapePattern(path)}$`, "m").test(result)) continue;
    result = `${result.replace(/\s*$/, "")}${result.trim() === "" ? "" : "\n\n"}${path}\n  Cache-Control: no-cache\n`;
  }
  return result;
};
