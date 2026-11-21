/**
 * @file The sync declarations an app's sources carry: a property declared with
 * `sync:` in a view, or a `sync` block on a `defineController` literal. A
 * string target (`sync: "<controller>"`) needs the view plugin only; a target
 * that is an identifier imported from `src/models/` is a model api, which
 * needs light's model binder too. A comment that mentions sync declares
 * nothing.
 */

import { stripComments } from "@lightstart/light/check/strip-comments.js";

/** What scanning one source answered. */
export interface ScannedSync {
  /** Whether the source declares a `sync:` property or a `sync` block. */
  sync: boolean;
  /** Whether a declared target is a model api imported from `src/models/`. */
  binder: boolean;
}

const SYNC = /\bsync\s*:/g;
const IMPORT = /\bimport\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const localNames = (clause: string): string[] => {
  const names: string[] = [];
  const braces = /\{([\s\S]*?)\}/.exec(clause);
  const head = clause.replace(/\{[\s\S]*?\}/, "");
  for (const part of head.split(",")) {
    const text = part.trim();
    if (text.length === 0) continue;
    const star = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(text);
    if (star !== null) {
      names.push(star[1] ?? "");
      continue;
    }
    if (IDENTIFIER.test(text)) names.push(text);
  }
  if (braces !== null) {
    for (const part of (braces[1] ?? "").split(",")) {
      const bits = part.trim().split(/\s+as\s+/);
      const local = (bits[1] ?? bits[0] ?? "").trim();
      if (IDENTIFIER.test(local)) names.push(local);
    }
  }
  return names.filter((name) => name.length > 0);
};

const modelNames = (code: string): string[] => {
  const names: string[] = [];
  for (const match of code.matchAll(IMPORT)) {
    if (match[1] !== undefined) continue;
    const specifier = match[3] ?? "";
    if (!specifier.startsWith(".") || !/(?:^|\/)models\//.test(specifier)) continue;
    for (const name of localNames(match[2] ?? "")) if (!names.includes(name)) names.push(name);
  }
  return names;
};

const valueAfter = (code: string, index: number): string => {
  let depth = 0;
  let quote: string | null = null;
  let i = index;
  for (; i < code.length; i++) {
    const char = code[i];
    if (quote !== null) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "[" || char === "(") depth++;
    else if (char === "}" || char === "]" || char === ")") {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (char === "," || char === ";")) break;
  }
  return code.slice(index, i);
};

const mentions = (value: string, name: string): boolean => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9_$.])${escaped}(?![\\w$])`).test(value);
};

/**
 * The sync declarations a source carries, without its comments.
 * @param {string} source
 * @returns {ScannedSync}
 */
export const scanSync = (source: string): ScannedSync => {
  const code = stripComments(source);
  const models = modelNames(code);
  let sync = false;
  let binder = false;
  for (const match of code.matchAll(SYNC)) {
    sync = true;
    const value = valueAfter(code, (match.index ?? 0) + match[0].length);
    if (models.some((name) => mentions(value, name))) binder = true;
  }
  return { sync, binder };
};
