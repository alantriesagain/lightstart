/**
 * @file Write `tags.json`: every component tag and the module, stylesheet,
 * base and tags its source names, read from the files beside it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(PKG, "tags.json");
const LOADERS = join(PKG, "loaders.js");
const COMPONENT = /export default defineComponent\s*\(/;
const TAG = /tag:\s*"([^"]+)"/;
const EXTENDS = /\bextends:\s*"([^"]+)"/;
const STYLE = /\bstyle:\s*true\b/;
const WRITTEN = /<\s*(lc-[a-z0-9-]+)/g;

/** @param {string} source */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Read the description a source's last doc comment carries above its tags. @param {string} sourceCode */
const extractDescription = (sourceCode) => {
  const matches = sourceCode.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!matches || matches.length === 0) return "";

  const lastComment = matches[matches.length - 1];
  const docstring = lastComment.replace(/^\/\*\*/, "").replace(/\*\/$/, "");

  const lines = docstring.split("\n");
  const descLines = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\s*\*\s?/, "").trim();

    if (cleaned.startsWith("@")) break;

    if (descLines.length === 0 && !cleaned) continue;

    descLines.push(cleaned);
  }

  return descLines.join("\n").trim();
};

/** Read every `@part` the source's last doc comment declares. @param {string} sourceCode */
const extractParts = (sourceCode) => {
  const matches = sourceCode.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!matches || matches.length === 0) return [];

  const lastComment = matches[matches.length - 1];
  const docstring = lastComment.replace(/^\/\*\*/, "").replace(/\*\/$/, "");
  const parts = [];
  const partRegex = /@part\s+(\S+)\s+-\s+(.+?)(?=\n\s*[@*]|$)/gm;
  let match;

  while ((match = partRegex.exec(docstring)) !== null)
    parts.push({
      name: match[1].trim(),
      description: match[2].trim(),
    });

  return parts;
};

/** Read every `@slot` the source's last doc comment declares. @param {string} sourceCode */
const extractSlots = (sourceCode) => {
  const matches = sourceCode.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!matches || matches.length === 0) return [];

  const lastComment = matches[matches.length - 1];
  const docstring = lastComment.replace(/^\/\*\*/, "").replace(/\*\/$/, "");
  const slots = [];
  const slotRegex = /@slot\s+([^\s-]*)\s*-?\s*(.*)$/gm;
  let match;

  while ((match = slotRegex.exec(docstring)) !== null) {
    const name = match[1].trim();
    const description = match[2].trim();

    slots.push({
      name: name || "default",
      description: description || "Default slot",
    });
  }

  return slots;
};

/** @param {string} dir @returns {string[]} */
const modules = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "scripts") return [];
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return modules(file);
    return entry.name.endsWith(".js") && !entry.name.endsWith(".demo.js") && !entry.name.endsWith(".test.js") ? [file] : [];
  });

/**
 * The components the sources declare, keyed by tag, in tag order.
 * @returns {Record<string, { module: string, style: string | null, extends: string | null, uses: string[], doc: { description: string, parts: { name: string, description: string }[], slots: { name: string, description: string }[] } }>}
 */
export const buildTags = () => {
  /** @type {Record<string, { module: string, style: string | null, extends: string | null, uses: string[], doc: { description: string, parts: { name: string, description: string }[], slots: { name: string, description: string }[] } }>} */
  const tags = {};
  for (const file of modules(PKG).sort()) {
    const text = readFileSync(file, "utf8");
    const source = stripComments(text);
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
      doc: {
        description: extractDescription(text),
        parts: extractParts(text),
        slots: extractSlots(text),
      },
    };
  }
  return Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)));
};

/**
 * The generated loader table: each tag to static imports of its module and, when
 * one sits beside it, its demo, so a bundler splits every one into a chunk.
 * @param {ReturnType<typeof buildTags>} tags
 */
export const buildLoaders = (tags = buildTags()) => {
  const entries = Object.entries(tags).map(([tag, entry]) => {
    const demo = entry.module.replace(/\.js$/, ".demo.js");
    const demoImport = existsSync(join(PKG, demo)) ? `, demo: () => import("./${demo}")` : "";
    return `  ${JSON.stringify(tag)}: { module: () => import("./${entry.module}")${demoImport} },`;
  });
  return [
    "/**",
    " * @file Generated by scripts/tags.js; do not edit. Each tag to a static import",
    " * of its module, and of the demo beside it when there is one.",
    " */",
    "export default {",
    ...entries,
    "};",
    "",
  ].join("\n");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tags = buildTags();
  writeFileSync(OUTPUT, `${JSON.stringify(tags, null, 2)}\n`);
  writeFileSync(LOADERS, buildLoaders(tags));
}
