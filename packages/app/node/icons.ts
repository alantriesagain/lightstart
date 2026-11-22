/**
 * @file The icon names an app's sources carry: the literal names an element
 * writes (`<lc-icon name="x">`, `icon="x"`, `icon: "x"`, `iconName: "x"`),
 * the names a module declares in its own `icons: ["x", ...]` array (or a
 * class's `static icons = [...]`), the
 * `solid` and `bold` variants an element asks for, the numeric sizes, and the
 * bindings whose name is an expression. A name that is not a literal is left
 * to the module's declaration; nothing follows an identifier to its value.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { stripComments } from "@lightstart/light/check/strip-comments.js";
import type { IconCollection, IconEntry } from "@lightstart/light/theme";

const ICON_NAME = /^[a-z][a-z0-9-]*$/;
const ROOT_OPEN = /<svg\b[^>]*>/i;
const COMMENT = /<!--[\s\S]*?-->/g;
const VIEW_BOX = /\bviewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const WIDTH = /(?:^|[\s])width\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HEIGHT = /(?:^|[\s])height\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HREF = /\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const PAINT = /\b(fill|stroke|color|stop-color)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const STYLE = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const ELEMENT = /<lc-icon\b[^>]*>/g;
const ATTRIBUTE = /\b([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\$\{([^}]*)\}))?/g;
const ICON_ATTRIBUTE = /(?:^|[^a-zA-Z])icon\s*=\s*(?:"([^"]*)"|'([^']*)'|\$\{([^}]*)\})/g;
const ICON_PROPERTY = /(?:^|[^a-zA-Z])icon\s*:\s*(?:"([^"]*)"|'([^']*)')/g;
const ICON_NAME_PROPERTY = /(?:^|[^a-zA-Z])iconName\s*:\s*(?:"([^"]*)"|'([^']*)')/g;
const DECLARED = /(?:^|[^a-zA-Z])icons\s*[:=]\s*\[([\s\S]*?)\]/g;
const STRING = /(?:"([^"]*)"|'([^']*)')/g;

/** A binding whose icon name is an expression rather than a literal. */
export interface DynamicIcon {
  /** The line the binding is on, counting from 1. */
  line: number;
  /** The expression inside `${...}`. */
  expr: string;
}

/** What scanning one source answered. */
export interface ScannedIcons {
  /** Every literal and declared name, in the order found. */
  names: string[];
  /** The names an element carries a `solid` attribute for. */
  solid: string[];
  /** The names an element carries a `bold` attribute for. */
  bold: string[];
  /** The numeric `size` values an `<lc-icon>` writes. */
  sizes: string[];
  /** The bindings whose name is an expression. */
  dynamic: DynamicIcon[];
  /** The names a module declares in its own `icons: [...]` array. */
  declared: string[];
  /** The names seen only as an `icon:` or `iconName:` property, which may be data rather than an icon. */
  properties: string[];
}

const lineOf = (source: string, index: number): number => {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === "\n") line += 1;
  return line;
};

const push = (list: string[], value: string | undefined): void => {
  if (value !== undefined && ICON_NAME.test(value) && !list.includes(value)) list.push(value);
};

/**
 * The icon names, variants, sizes and dynamic bindings a source carries.
 * @param {string} source
 * @returns {ScannedIcons}
 */
export const scanIcons = (source: string): ScannedIcons => {
  const code = stripComments(source);
  const names: string[] = [];
  const solid: string[] = [];
  const bold: string[] = [];
  const sizes: string[] = [];
  const dynamic: DynamicIcon[] = [];
  const declared: string[] = [];

  for (const element of code.matchAll(ELEMENT)) {
    const text = element[0];
    const start = element.index ?? 0;
    let name: string | undefined;
    let hasSolid = false;
    let hasBold = false;
    for (const attribute of text.matchAll(ATTRIBUTE)) {
      const key = attribute[1];
      const literal = attribute[2] ?? attribute[3];
      const expression = attribute[4];
      if (key === "name" || key === "icon" || key === "iconName") {
        if (literal !== undefined) name = literal;
        else if (expression !== undefined) dynamic.push({ line: lineOf(code, start), expr: expression.trim() });
      }
      if (key === "solid" && attribute[2] === undefined && attribute[3] === undefined && attribute[4] === undefined) hasSolid = true;
      if (key === "bold" && attribute[2] === undefined && attribute[3] === undefined && attribute[4] === undefined) hasBold = true;
      if (key === "size" && literal !== undefined && /^\d+$/.test(literal) && !sizes.includes(literal)) sizes.push(literal);
    }
    if (name !== undefined && ICON_NAME.test(name)) {
      push(names, name);
      if (hasSolid) push(solid, name);
      if (hasBold) push(bold, name);
    }
  }

  for (const match of code.matchAll(ICON_ATTRIBUTE)) {
    const literal = match[1] ?? match[2];
    const expression = match[3];
    if (literal !== undefined) push(names, literal);
    else if (expression !== undefined) dynamic.push({ line: lineOf(code, match.index ?? 0), expr: expression.trim() });
  }
  const drawn = [...names];
  const properties: string[] = [];
  for (const match of code.matchAll(ICON_PROPERTY)) push(properties, match[1] ?? match[2]);
  for (const match of code.matchAll(ICON_NAME_PROPERTY)) push(properties, match[1] ?? match[2]);
  for (const name of properties) push(names, name);

  for (const match of code.matchAll(DECLARED)) {
    const list = match[1] ?? "";
    if (/[{(]/.test(list)) continue;
    for (const string of list.matchAll(STRING)) {
      const name = string[1] ?? string[2];
      if (name === undefined || !ICON_NAME.test(name)) continue;
      push(declared, name);
      push(names, name);
    }
  }

  return { names, solid, bold, sizes, dynamic, declared, properties: properties.filter((name) => !drawn.includes(name) && !declared.includes(name)) };
};

/** One icon the app draws from its own `icons/` folder. */
export interface OwnIcon {
  /** The file name without `.svg`. */
  name: string;
  /** The Iconify entry the file draws, sized from its `viewBox`. */
  entry: IconEntry;
  /** The file, relative to the project. */
  file: string;
}

const numberOf = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match === null ? fallback : Number(match[0]);
};

const svgOf = (text: string): { opening: string; body: string } | null => {
  const match = ROOT_OPEN.exec(text);
  if (match === null) return null;
  const start = (match.index ?? 0) + match[0].length;
  const end = text.lastIndexOf("</svg>");
  if (end < start) return null;
  return { opening: match[0], body: text.slice(start, end).replace(COMMENT, "").trim() };
};

const sizesOf = (opening: string): { width: number; height: number } => {
  const box = VIEW_BOX.exec(opening);
  if (box !== null) {
    const parts = (box[1] ?? box[2] ?? "").trim().split(/[\s,]+/);
    if (parts.length >= 4) return { width: numberOf(parts[2], 24), height: numberOf(parts[3], 24) };
  }
  const width = WIDTH.exec(opening);
  const height = HEIGHT.exec(opening);
  return { width: numberOf(width?.[1] ?? width?.[2], 24), height: numberOf(height?.[1] ?? height?.[2], 24) };
};

const ROOT_PAINT = /\b(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|fill-rule|clip-rule)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** The body inside a `<g>` carrying the root `<svg>`'s paint attributes, which a mask's own bare `<svg>` would drop; written with double quotes, as the solid and bold variants read them. */
const withRootPaint = (opening: string, body: string): string => {
  const attributes: string[] = [];
  for (const match of opening.matchAll(ROOT_PAINT)) attributes.push(`${(match[1] ?? "").toLowerCase()}="${match[2] ?? match[3] ?? ""}"`);
  return attributes.length === 0 ? body : `<g ${attributes.join(" ")}>${body}</g>`;
};

/**
 * The app's own icons in `icons/`, each file named by its icon name and sized
 * from its root `<svg>`'s viewBox, then its width and height, then 24. A file
 * whose name is not a valid icon name is left out, as is one with no root
 * element.
 * @param {string} project
 * @returns {OwnIcon[]}
 */
export const ownIcons = (project: string): OwnIcon[] => {
  const dir = join(project, "icons");
  if (!existsSync(dir)) return [];
  const icons: OwnIcon[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))) {
    if (!entry.isFile() || !entry.name.endsWith(".svg")) continue;
    const name = entry.name.slice(0, -".svg".length);
    if (!ICON_NAME.test(name)) continue;
    let text: string;
    try {
      text = readFileSync(join(dir, entry.name), "utf8");
    } catch {
      continue;
    }
    const svg = svgOf(text);
    if (svg === null) continue;
    const { width, height } = sizesOf(svg.opening);
    icons.push({ name, entry: { body: withRootPaint(svg.opening, svg.body), width, height }, file: `icons/${entry.name}` });
  }
  return icons;
};

/**
 * What keeps one SVG file from being a safe mask: no root `<svg>`, no
 * `viewBox`, a script, an event attribute, a link out of the file, an image, a
 * foreign object, or a colour where a mask keeps only the shape.
 * @param {string} text
 * @returns {string[]}
 */
export const svgProblems = (text: string): string[] => {
  const source = text.replace(COMMENT, "");
  const root = ROOT_OPEN.exec(source);
  if (root === null) return ["has no root <svg> element"];
  const problems: string[] = [];
  if (!VIEW_BOX.test(root[0])) problems.push("has no viewBox on its root <svg>");
  if (/<script\b/i.test(source)) problems.push("carries a <script>");
  if (/\son[a-z]+\s*=/i.test(source)) problems.push("carries an on* event attribute");
  for (const match of source.matchAll(HREF)) {
    const value = match[1] ?? match[2] ?? "";
    if (!value.startsWith("#")) problems.push(`has an href "${value}" that is not a #fragment`);
  }
  if (/<image\b/i.test(source)) problems.push("carries an <image>");
  if (/<foreignObject\b/i.test(source)) problems.push("carries a <foreignObject>");
  for (const match of source.matchAll(PAINT)) {
    const attribute = match[1] ?? "";
    const value = (match[2] ?? match[3] ?? "").trim();
    if (value === "currentColor" || value.toLowerCase() === "none" || /^url\(\s*#[^)]*\)$/i.test(value)) continue;
    problems.push(`sets ${attribute} to "${value}", a colour; draw with currentColor or none`);
  }
  for (const match of source.matchAll(STYLE)) {
    const value = match[1] ?? match[2] ?? "";
    if (/(?:^|[;{\s])(?:[a-z-]*(?:color)|fill|stroke)\s*:/i.test(value)) problems.push(`sets a colour in a style attribute ("${value}")`);
  }
  return problems;
};

/**
 * An Iconify collection from the app's installed `@iconify-json/<set>`, or
 * null when the package does not resolve or its JSON cannot be read.
 * @param {string} project
 * @param {string} set
 * @returns {IconCollection | null}
 */
export const collectionOf = (project: string, set: string): IconCollection | null => {
  const relative = join(project, "node_modules", "@iconify-json", set, "icons.json");
  let path = existsSync(relative) ? relative : null;
  if (path === null) {
    try {
      path = createRequire(join(project, "package.json")).resolve(`@iconify-json/${set}/icons.json`);
    } catch {
      return null;
    }
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return typeof value === "object" && value !== null ? (value as IconCollection) : null;
  } catch {
    return null;
  }
};
