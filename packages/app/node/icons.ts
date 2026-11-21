/**
 * @file The icon names an app's sources carry: the literal names an element
 * writes (`<lc-icon name="x">`, `icon="x"`, `icon: "x"`, `iconName: "x"`),
 * the names a module declares in its own `icons: ["x", ...]` array (or a
 * class's `static icons = [...]`), the
 * `solid` and `bold` variants an element asks for, the numeric sizes, and the
 * bindings whose name is an expression. A name that is not a literal is left
 * to the module's declaration; nothing follows an identifier to its value.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { stripComments } from "@lightstart/light/check/strip-comments.js";
import type { IconCollection } from "@lightstart/light/theme";

const ICON_NAME = /^[a-z][a-z0-9-]*$/;
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
    for (const string of (match[1] ?? "").matchAll(STRING)) {
      const name = string[1] ?? string[2];
      if (name === undefined || !ICON_NAME.test(name)) continue;
      push(declared, name);
      push(names, name);
    }
  }

  return { names, solid, bold, sizes, dynamic, declared, properties: properties.filter((name) => !drawn.includes(name) && !declared.includes(name)) };
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
