/**
 * Language names by alias: fence info strings and file extensions.
 */

/** @type {Record<string, string>} */
const ALIASES = {
  javascript: "javascript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "javascript",
  typescript: "javascript",
  json: "javascript",
  css: "css",
  html: "html",
  htm: "html",
  xml: "html",
  svg: "html",
  markdown: "markdown",
  md: "markdown",
  mdx: "markdown",
};

/**
 * @param {string | null | undefined} alias
 * @returns {string | null}
 */
export const languageName = (alias) => (alias ? (ALIASES[alias.toLowerCase()] ?? null) : null);

/**
 * @param {string | null | undefined} path
 * @returns {string | null}
 */
export const languageNameForPath = (path) => {
  if (!path) return null;
  const file = path.split(/[\\/]/).pop() ?? "";
  const dot = file.lastIndexOf(".");
  return dot === -1 ? null : languageName(file.slice(dot + 1));
};
