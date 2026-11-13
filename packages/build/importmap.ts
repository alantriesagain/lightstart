/**
 * @file A page's importmap: parse it and resolve a bare specifier through its exact keys and its
 * trailing-slash prefix keys, the longest prefix first, to a path relative to the page.
 */
import { resolve } from "node:path";

/** The importmap of a page: its `imports` map of specifier keys to targets. */
export type ImportMap = { imports: Record<string, string> };

const hasScheme = (value: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(value);

const isRemote = (target: string): boolean => target.startsWith("//") || hasScheme(target);

const joinTarget = (target: string, rest: string): string => {
  if (rest === "") return target;
  return target.endsWith("/") ? target + rest : target + "/" + rest;
};

const targetPath = (target: string, pageDir: string): string | null => {
  if (isRemote(target)) return null;
  return resolve(pageDir, target);
};

/** Parse the JSON text of an importmap script into its `imports` map. */
export const parseImportMap = (text: string): ImportMap => {
  const value = JSON.parse(text) as { imports?: Record<string, string> };
  return { imports: value.imports ?? {} };
};

/** Resolve a bare specifier through an importmap to an absolute path, or null when it names none. */
export const resolveSpecifier = (importMap: ImportMap, specifier: string, pageDir: string): string | null => {
  const imports = importMap.imports;
  if (Object.hasOwn(imports, specifier)) return targetPath(imports[specifier]!, pageDir);
  let best = "";
  for (const key of Object.keys(imports)) {
    if (!key.endsWith("/") || !specifier.startsWith(key)) continue;
    if (key.length > best.length) best = key;
  }
  if (best === "") return null;
  return targetPath(joinTarget(imports[best]!, specifier.slice(best.length)), pageDir);
};
