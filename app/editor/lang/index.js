/**
 * The languages by name, and the lookups the editor uses to pick one.
 */

/** @import { Language } from "../types.js" */
import { languageName, languageNameForPath } from "./aliases.js";
import css from "./css.js";
import html from "./html.js";
import javascript from "./javascript.js";
import markdown from "./markdown.js";
import { defineMode } from "./mode.js";

/** @type {Record<string, Language>} */
export const languages = { javascript, css, html, markdown };

/** No highlighting: the language of a file nothing else claims. */
export const plain = defineMode({
  name: "plain",
  startState: () => ({}),
  token(stream) {
    stream.skipToEnd();
    return null;
  },
});

/**
 * @param {string | null | undefined} name a language name or alias
 * @returns {Language | null}
 */
export const byName = (name) => {
  const resolved = languageName(name);
  return resolved ? languages[resolved] : null;
};

/**
 * @param {string | null | undefined} path
 * @returns {Language | null}
 */
export const languageForPath = (path) => {
  const name = languageNameForPath(path);
  return name ? languages[name] : null;
};

export { css, html, javascript, markdown };
