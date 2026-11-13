/**
 * @file The module transform the dev server injects: TypeScript stripped in place through
 * `node:module`, bare specifiers rewritten through the importmap; node-only because of both.
 */
import { stripTypeScriptTypes } from "node:module";
import { extname } from "node:path";
import { Transformed } from "@lightstart/server/static";
import type { ImportMap } from "../importmap.ts";
import { rewriteSpecifiers } from "../rewrite.ts";
import type { ModuleTransform } from "../types.ts";

const MODULES = new Set([".js", ".mjs", ".ts", ".tsx", ".mts"]);
const TYPESCRIPT = new Set([".ts", ".tsx", ".mts"]);

/** A TypeScript module as the JavaScript a browser runs, its annotations blanked in place. */
export const stripTypes = (source: string): string => {
  const warn = process.emitWarning;
  process.emitWarning = () => {};
  try {
    return stripTypeScriptTypes(source);
  } finally {
    process.emitWarning = warn;
  }
};

/** The transform a run's files share: only modules are touched, and never a `.d.ts`. */
export const createModuleTransform = (importmap: ImportMap): ModuleTransform => (path: string, body: Uint8Array): Transformed | null => {
  const extension = extname(path).toLowerCase();
  if (!MODULES.has(extension)) return null;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let source = decoder.decode(body);
  if (TYPESCRIPT.has(extension) && !path.endsWith(".d.ts")) {
    try {
      source = stripTypes(source);
    } catch (error) {
      throw new Error(path + ": " + (error instanceof Error ? error.message : String(error)));
    }
  }
  return new Transformed(encoder.encode(rewriteSpecifiers(source, importmap)), "text/javascript; charset=utf-8");
};
