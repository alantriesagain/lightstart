import { defineRule } from "@lightstart/light/check/define.js";
import { defaultExportExpression, resolveLocal, sourceFile } from "@lightstart/light/check/parse/ast.js";
import ts from "@lightstart/light/check/parse/typescript.js";

const LOCALE_FILE = /^src\/locales\/([^/]+)\.(js|ts)$/;

/** @param {string} file */
const langOf = (file) => LOCALE_FILE.exec(file)?.[1] ?? null;

/**
 * The leaf paths of an object, joined with dots, so `nav.map` is compared
 * rather than the whole `nav` object.
 * @param {import("typescript").ObjectLiteralExpression} literal
 * @param {string} [prefix]
 * @param {Set<string>} [out]
 * @returns {Set<string>}
 */
const keysOf = (literal, prefix = "", out = new Set()) => {
  for (const member of literal.properties) {
    if (ts.isSpreadAssignment(member)) continue;
    const name = ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) ? member.name.text : null;
    if (name === null) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    if (ts.isPropertyAssignment(member)) {
      const value = resolveLocal(member.initializer);
      if (value && ts.isObjectLiteralExpression(value)) keysOf(value, key, out);
      else out.add(key);
    } else out.add(key);
  }
  return out;
};

/** @param {import("@lightstart/light/check/types.ts").ProjectModel} ctx @param {string} file */
const keysIn = (ctx, file) => {
  const source = ctx.code(file);
  if (!source) return null;
  const sf = sourceFile(source, file);
  const exported = defaultExportExpression(sf);
  const resolved = exported ? resolveLocal(exported) : null;
  return resolved && ts.isObjectLiteralExpression(resolved) ? keysOf(resolved) : null;
};

/** @param {import("@lightstart/light/check/types.ts").ProjectModel} ctx */
const defaultLocale = (ctx) => {
  for (const file of ctx.files()) {
    if (!/^src\/app\.(js|ts)$/.test(file)) continue;
    const match = (ctx.code(file) ?? "").match(/\blocale\s*:\s*["']([^"']+)["']/);
    if (match) return match[1];
  }
  return "en";
};

/** @param {Set<string>} wanted @param {Set<string>} got */
const difference = (wanted, got) => [...wanted].filter((key) => !got.has(key));

export default defineRule({
  severity: "error",
  description: "each locale file has the default locale's keys, no more and no fewer",
  why: "a missing key falls back to the default language and an extra one is never shown, so a translation looks complete until a page reaches the word nobody translated; keeping the key sets equal makes the gap visible where the locale is written",
  check(ctx) {
    const files = ctx.files().filter((file) => langOf(file) !== null && !/\.test\.(js|ts)$/.test(file));
    if (!files.length) return;
    const wanted = defaultLocale(ctx);
    const defaultFile = files.find((file) => langOf(file) === wanted);
    if (!defaultFile) return;
    const reference = keysIn(ctx, defaultFile);
    if (!reference) return;
    for (const file of files) {
      if (file === defaultFile) continue;
      const keys = keysIn(ctx, file);
      if (!keys) continue;
      const missing = difference(reference, keys);
      const extra = difference(keys, reference);
      if (!missing.length && !extra.length) continue;
      const parts = [];
      if (missing.length) parts.push(`missing ${missing.map((key) => `"${key}"`).join(", ")}`);
      if (extra.length) parts.push(`extra ${extra.map((key) => `"${key}"`).join(", ")}`);
      ctx.report({ file, offset: 0, message: `locale "${langOf(file)}" does not match "${wanted}": ${parts.join("; ")}` });
    }
  },
});
