/**
 * @file Every built-in grammar at once, for a caller that tokenizes
 * synchronously and cannot await `loadLanguage` (a terminal view, a test).
 * Importing it registers JavaScript, TypeScript, CSS, HTML and Markdown.
 */
import "./lang/javascript.ts";
import "./lang/typescript.ts";
import "./lang/css.ts";
import "./lang/html.ts";
import "./lang/markdown.ts";

/** Kept for callers that register at start; the imports above already did. */
export const registerLanguages = (): void => {};
