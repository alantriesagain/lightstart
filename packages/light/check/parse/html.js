/**
 * The JavaScript of an html page: its `<script type="module">` blocks, with
 * everything around them blanked so every offset is the page's own and a
 * line number points into the page.
 */

import { blank } from "../strip-comments.js";

const MODULE_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script\s*>/gi;

/**
 * @param {string} html
 * @returns {string} the same length as `html`, newlines kept
 */
export const moduleScripts = (html) => {
  let out = "";
  let cursor = 0;
  for (const match of html.matchAll(MODULE_SCRIPT)) {
    const start = match.index + match[0].indexOf(">") + 1;
    out += blank(html.slice(cursor, start)) + match[1];
    cursor = start + match[1].length;
  }
  return out + blank(html.slice(cursor));
};
