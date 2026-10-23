/**
 * TypeScript AST helpers shared by the parsers: a source file, the default
 * export, and the shape of a `T.*()` property declaration.
 */

import * as ts from "typescript";

/** @import { Expression, Node, ObjectLiteralExpression, SourceFile } from "typescript" */

/**
 * @param {string} source
 * @param {string} filename
 * @returns {SourceFile}
 */
export const sourceFile = (source, filename) =>
  ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS);

/**
 * The expression of `export default <expr>`, or null.
 * @param {SourceFile} sf
 * @returns {Expression | null}
 */
export const defaultExportExpression = (sf) => {
  for (const n of sf.statements) if (ts.isExportAssignment(n)) return n.expression;
  return null;
};

/**
 * The initializer of a top-level `const <name> = ...` in a module, exported or
 * not.
 * @param {SourceFile} sf
 * @param {string} name
 * @returns {Expression | null}
 */
export const localInitializer = (sf, name) => {
  for (const n of sf.statements)
    if (ts.isVariableStatement(n))
      for (const decl of n.declarationList.declarations)
        if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) return decl.initializer;
  return null;
};

/**
 * The expression behind an expression: parentheses removed, an identifier
 * followed to the top-level const it names in the same module. An identifier
 * the module does not declare comes back as itself; a self-reference answers
 * null.
 * @param {Node | undefined | null} expr
 * @param {Set<string>} [seen] identifiers already followed
 * @returns {Expression | null}
 */
export const resolveLocal = (expr, seen = new Set()) => {
  if (!expr) return null;
  if (ts.isParenthesizedExpression(expr)) return resolveLocal(expr.expression, seen);
  if (ts.isIdentifier(expr)) {
    if (seen.has(expr.text)) return null;
    seen.add(expr.text);
    const sf = expr.getSourceFile();
    const local = sf ? localInitializer(sf, expr.text) : null;
    return local ? resolveLocal(local, seen) : expr;
  }
  return /** @type {Expression} */ (expr);
};

/**
 * The object literal behind an expression: a literal, a call whose last
 * argument holds one (`defineComponent(...)`), a function returning one, a
 * parenthesised form of any of those, or an identifier naming a top-level
 * const in the same module that holds one, which is how a definition assigned
 * to a name and default-exported below still reads as a definition.
 * @param {Node | undefined | null} expr
 * @param {Set<string>} [seen] identifiers already followed, so a self-reference terminates
 * @returns {ObjectLiteralExpression | null}
 */
export const unwrapToLiteral = (expr, seen = new Set()) => {
  const resolved = resolveLocal(expr, seen);
  if (!resolved || ts.isIdentifier(resolved)) return null;
  if (ts.isObjectLiteralExpression(resolved)) return resolved;
  if (ts.isCallExpression(resolved)) return unwrapToLiteral(resolved.arguments[resolved.arguments.length - 1], seen);
  if (ts.isArrowFunction(resolved) || ts.isFunctionExpression(resolved)) {
    const body = resolved.body;
    if (!ts.isBlock(body)) return unwrapToLiteral(body, seen);
    for (const stmt of body.statements)
      if (ts.isReturnStatement(stmt) && stmt.expression) return unwrapToLiteral(stmt.expression, seen);
    return null;
  }
  return null;
};

/**
 * @param {Node | undefined} node
 * @returns {string | null}
 */
export const nameOf = (node) => {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
};

/**
 * @param {Expression | null | undefined} expr
 * @returns {Expression | null | undefined}
 */
export const unwrapParens = (expr) => {
  while (expr && ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
};

/**
 * The `T.x(...)` call a property is declared with, looked through a JSDoc cast.
 * @param {Node} p
 * @returns {import("typescript").CallExpression | null}
 */
export const typeCallOf = (p) => {
  if (!ts.isPropertyAssignment(p)) return null;
  const init = unwrapParens(p.initializer);
  return init && ts.isCallExpression(init) ? init : null;
};

/** @param {Node} v */
const isNullish = (v) => v.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(v) && v.text === "undefined");

/**
 * The initializer of one option in a `T.x({ option: value })` declaration.
 * @param {Node} p
 * @param {string} option
 * @returns {Expression | undefined}
 */
export const typeOption = (p, option) => {
  const call = typeCallOf(p);
  const arg = call?.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  for (const opt of arg.properties)
    if (nameOf(opt.name) === option && ts.isPropertyAssignment(opt)) return opt.initializer;
  return undefined;
};

/**
 * Whether a property declaration carries a default other than null or
 * undefined: `T.x(value)`, `T.x({ defaultValue: value })`, or a bare value
 * standing in for the descriptor (`count: 0`).
 * @param {Node} p
 * @returns {boolean}
 */
export const hasNonNullDefault = (p) => {
  const call = typeCallOf(p);
  if (!call && ts.isPropertyAssignment(p)) {
    const init = unwrapParens(p.initializer);
    return !!init && !isNullish(init);
  }
  const arg = call?.arguments[0];
  if (!arg) return false;
  if (!ts.isObjectLiteralExpression(arg)) return !isNullish(arg);
  const v = typeOption(p, "defaultValue");
  return v !== undefined && !isNullish(v);
};

/**
 * The module specifier and exported name behind a local identifier bound by a
 * named import, or null when the identifier is not imported.
 * @param {import("typescript").SourceFile} sf
 * @param {string} localName
 * @returns {{ spec: string, exported: string } | null}
 */
export const importBinding = (sf, localName) => {
  for (const n of sf.statements) {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteral(n.moduleSpecifier)) continue;
    const bindings = n.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements)
      if (element.name.text === localName) return { spec: n.moduleSpecifier.text, exported: (element.propertyName ?? element.name).text };
  }
  return null;
};

/**
 * The local name of the default import of a module whose specifier `matches`,
 * or null when the file imports no such module.
 * @param {SourceFile} sf
 * @param {(spec: string) => boolean} matches
 * @returns {string | null}
 */
export const defaultImportBinding = (sf, matches) => {
  for (const n of sf.statements)
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.importClause?.name && matches(n.moduleSpecifier.text)) return n.importClause.name.text;
  return null;
};

/**
 * The initializer of `export const <name> = ...` in a module.
 * @param {import("typescript").SourceFile} sf
 * @param {string} name
 * @returns {import("typescript").Expression | null}
 */
export const exportedInitializer = (sf, name) => {
  for (const n of sf.statements)
    if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      for (const decl of n.declarationList.declarations)
        if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) return decl.initializer;
  return null;
};

/**
 * The fragments a definition literal composes: every `mixins: [...]` entry and
 * every `...spread` that is a named import (or a call on one), as the module
 * specifier and exported name of each.
 *
 * A spread is the older form of the same composition, and what it carries is
 * on the instance exactly as a mixin's members are. Reading only `mixins:`
 * makes every spread-in method look like an undeclared field.
 *
 * @param {import("typescript").SourceFile} sf
 * @param {import("typescript").ObjectLiteralExpression} literal
 * @returns {Array<{ spec: string, exported: string }>}
 */
export const mixinBindings = (sf, literal) => {
  /** @type {Array<{ spec: string, exported: string }>} */
  const out = [];
  const follow = (/** @type {import("typescript").Expression} */ entry) => {
    const head = ts.isCallExpression(entry) ? entry.expression : entry;
    const binding = ts.isIdentifier(head) ? importBinding(sf, head.text) : null;
    if (binding) out.push(binding);
  };
  for (const m of literal.properties) {
    if (ts.isSpreadAssignment(m)) {
      follow(m.expression);
      continue;
    }
    if (nameOf(m.name) !== "mixins" || !ts.isPropertyAssignment(m) || !ts.isArrayLiteralExpression(m.initializer)) continue;
    for (const entry of m.initializer.elements) follow(entry);
  }
  return out;
};
