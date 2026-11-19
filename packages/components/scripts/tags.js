/**
 * @file Write `tags.json`: every component tag and the module, stylesheet,
 * base and tags its source names, read from the files beside it. The tags a
 * component writes include those of the helper modules it imports (the form's
 * table of controls), so a page that defines the component defines them too.
 * A helper module marked `@tags-on-demand` instead gives the component a
 * `loads` list: tags it can define later, when it is about to draw them.
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
const IMPORTED = /(?:\bfrom\s+|^\s*import\s+)"(\.{1,2}\/[^"]+\.js)"/gm;
const ON_DEMAND = /@tags-on-demand\b/;

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

/**
 * Whether the module's first comment carries `@tags-on-demand`: what it writes
 * is defined only when a component is about to draw it.
 * @param {string} text
 */
const marksOnDemand = (text) => {
  const first = text.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  return first !== null && ON_DEMAND.test(first[1]);
};

/**
 * The tags `file` writes eagerly and the ones it writes on demand, with those
 * of the helper modules it imports statically, followed through each; a
 * component's module is left out, its tags are its own. A helper module marked
 * `@tags-on-demand`, and everything below it, contributes to `loads`.
 * @param {string} file
 * @param {boolean} [onDemand]
 * @param {Set<string>} [stack]
 * @returns {{ uses: Set<string>, loads: Set<string> }}
 */
const writtenTags = (file, onDemand = false, stack = new Set()) => {
  const found = { uses: new Set(), loads: new Set() };
  if (stack.has(file)) return found;
  stack.add(file);
  const text = readFileSync(file, "utf8");
  const source = stripComments(text);
  const lazy = onDemand || marksOnDemand(text);
  for (const match of source.matchAll(WRITTEN))
    (lazy ? found.loads : found.uses).add(match[1]);
  for (const match of source.matchAll(IMPORTED)) {
    const target = join(dirname(file), match[1]);
    if (!existsSync(target) || COMPONENT.test(stripComments(readFileSync(target, "utf8")))) continue;
    const below = writtenTags(target, lazy, stack);
    for (const tag of below.uses) found.uses.add(tag);
    for (const tag of below.loads) found.loads.add(tag);
  }
  stack.delete(file);
  return found;
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
 * @returns {Record<string, { module: string, style: string | null, extends: string | null, uses: string[], loads: string[], doc: { description: string, parts: { name: string, description: string }[], slots: { name: string, description: string }[] } }>}
 */
export const buildTags = () => {
  /** @type {Record<string, { module: string, style: string | null, extends: string | null, uses: string[], loads: string[], doc: { description: string, parts: { name: string, description: string }[], slots: { name: string, description: string }[] } }>} */
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
    const found = writtenTags(file);
    found.uses.delete(tag);
    found.loads.delete(tag);
    for (const used of found.uses) found.loads.delete(used);
    tags[tag] = {
      module: relative(PKG, file).split(sep).join("/"),
      style: STYLE.test(block) && existsSync(style) ? relative(PKG, style).split(sep).join("/") : null,
      extends: block.match(EXTENDS)?.[1] ?? null,
      uses: [...found.uses].sort(),
      loads: [...found.loads].sort(),
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
