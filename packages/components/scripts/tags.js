/**
 * @file Write `tags.json`: every component tag and the module, stylesheet,
 * base and tags its source names, read from the files beside it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(PKG, "tags.json");
const COMPONENT = /export default defineComponent\s*\(/;
const TAG = /tag:\s*"([^"]+)"/;
const EXTENDS = /\bextends:\s*"([^"]+)"/;
const STYLE = /\bstyle:\s*true\b/;
const WRITTEN = /<\s*(lc-[a-z0-9-]+)/g;

/** @param {string} source */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** @param {string} dir @returns {string[]} */
const modules = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "scripts") return [];
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return modules(file);
    return entry.name.endsWith(".js") && !entry.name.endsWith(".demo.js") && !entry.name.endsWith(".test.js") ? [file] : [];
  });

/** The components the sources declare, keyed by tag, in tag order. @returns {Record<string, { module: string, style: string | null, extends: string | null, uses: string[] }>} */
export const buildTags = () => {
  /** @type {Record<string, { module: string, style: string | null, extends: string | null, uses: string[] }>} */
  const tags = {};
  for (const file of modules(PKG).sort()) {
    const source = stripComments(readFileSync(file, "utf8"));
    const at = source.search(COMPONENT);
    if (at < 0) continue;
    const block = source.slice(at);
    const tag = block.match(TAG)?.[1];
    if (tag === undefined) continue;
    const style = file.replace(/\.js$/, ".css");
    const used = new Set();
    for (const match of source.matchAll(WRITTEN)) if (match[1] !== tag) used.add(match[1]);
    tags[tag] = {
      module: relative(PKG, file).split(sep).join("/"),
      style: STYLE.test(block) && existsSync(style) ? relative(PKG, style).split(sep).join("/") : null,
      extends: block.match(EXTENDS)?.[1] ?? null,
      uses: [...used].sort(),
    };
  }
  return Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(OUTPUT, `${JSON.stringify(buildTags(), null, 2)}\n`);
