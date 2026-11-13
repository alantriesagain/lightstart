/**
 * @file Bare import specifiers rewritten through an importmap, only where a module imports:
 * `from "..."`, an `export ... from "..."`, a side-effect `import "..."` and `import("...")`.
 */
import type { ImportMap } from "./importmap.ts";

const lookup = (importmap: ImportMap, key: string): string | null => {
  for (const [name, target] of Object.entries(importmap)) if (name === key) return target;
  return null;
};

/** The URL path a bare specifier resolves to through `importmap`, or null when it maps to none. */
export const resolveSpecifier = (specifier: string, importmap: ImportMap): string | null => {
  const exact = lookup(importmap, specifier);
  if (exact !== null) return exact;
  const start = specifier.startsWith("@") ? specifier.indexOf("/") + 1 : 0;
  const slash = specifier.indexOf("/", start);
  if (slash === -1) return null;
  const base = lookup(importmap, specifier.slice(0, slash + 1));
  return base === null ? null : base + specifier.slice(slash + 1);
};

const isBare = (specifier: string): boolean => !/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/|\.)/.test(specifier);

const IMPORT_SPECIFIER = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\2/g;

/** Every bare specifier in `source` that the map names, replaced by its URL path. */
export const rewriteSpecifiers = (source: string, importmap: ImportMap): string => {
  if (Object.keys(importmap).length === 0) return source;
  return source.replace(IMPORT_SPECIFIER, (match: string, prefix: string, quote: string, specifier: string) => {
    if (!isBare(specifier)) return match;
    const target = resolveSpecifier(specifier, importmap);
    return target === null ? match : prefix + quote + target + quote;
  });
};
