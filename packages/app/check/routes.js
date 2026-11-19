import { defaultExportExpression, nameOf, resolveLocal, sourceFile } from "@lightstart/light/check/parse/ast.js";
import ts from "@lightstart/light/check/parse/typescript.js";

/** @param {string} file */
export const isRoutesFile = (file) => /^src\/routes\.(js|ts)$/.test(file);

/**
 * The routes table a module default-exports, when it is an object literal or a
 * name bound to one.
 * @param {string} source
 * @param {string} file
 * @returns {{ sf: import("typescript").SourceFile, table: import("typescript").ObjectLiteralExpression } | null}
 */
export const routesTable = (source, file) => {
  const sf = sourceFile(source, file);
  const exported = defaultExportExpression(sf);
  const resolved = exported ? resolveLocal(exported) : null;
  if (!resolved || !ts.isObjectLiteralExpression(resolved)) return null;
  return { sf, table: resolved };
};

/**
 * The static key of a property in a routes table, or null when it is computed
 * or not a literal name.
 * @param {import("typescript").ObjectLiteralElementLike} member
 * @returns {{ name: string, offset: number } | null}
 */
export const routeKey = (member) => {
  if (ts.isComputedPropertyName(member.name)) return null;
  const name = nameOf(member.name);
  return name === null ? null : { name, offset: member.name.getStart() };
};

/** A path with its trailing slash removed, except the root. */
export const normalisePath = (path) => (path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") || "/" : path);
