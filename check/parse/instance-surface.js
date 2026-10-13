/**
 * The instance surface a definition literal reaches through `this`, shared by
 * `declare-instance-surface` and `controller-declare-instance-surface`: every `this.<name>`
 * that is assigned, member-accessed or called, and the names a `mixins:`
 * fragment declares (resolved through the module that exports it, and through
 * that fragment's own mixins).
 */

import path from "node:path";
import * as ts from "typescript";
import { exportedInitializer, mixinBindings, nameOf, sourceFile, unwrapToLiteral } from "./ast.js";
import { definitionOf, parseComponentSources } from "./component.js";

const ASSIGN_OPS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
]);

/**
 * `this.<name>` fields reached inside `literal` that are neither in `declared`
 * nor `$`-prefixed nor excused by `skip`, once per name at its first reach.
 * @param {{ literal: ts.ObjectLiteralExpression, sf: ts.SourceFile, declared: Set<string>, skip?: (name: string) => boolean }} opts
 * @returns {Array<{ name: string, offset: number }>}
 */
export const findUndeclaredInstanceFields = ({ literal, sf, declared, skip = () => false }) => {
  /** @type {Map<string, number>} */
  const accessed = new Map();
  /** @type {(node: ts.Node) => node is ts.PropertyAccessExpression} */
  const isThisField = (node) => ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword;
  /** @param {ts.PropertyAccessExpression} fieldAccess */
  const record = (fieldAccess) => {
    const name = fieldAccess.name.text;
    if (!accessed.has(name)) accessed.set(name, fieldAccess.name.getStart(sf));
  };
  /** @param {ts.Node} node */
  const walk = (node) => {
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node)) && isThisField(node.expression))
      record(node.expression);
    if (ts.isBinaryExpression(node) && ASSIGN_OPS.has(node.operatorToken.kind) && isThisField(node.left))
      record(node.left);
    ts.forEachChild(node, walk);
  };
  walk(literal);
  /** @type {Array<{ name: string, offset: number }>} */
  const out = [];
  for (const [name, offset] of accessed)
    if (!declared.has(name) && !name.startsWith("$") && !skip(name)) out.push({ name, offset });
  return out;
};

/**
 * The `props` keys of a definition literal.
 * @param {ts.ObjectLiteralExpression} literal
 * @returns {string[]}
 */
export const declaredPropertyNames = (literal) => {
  /** @type {string[]} */
  const out = [];
  for (const m of literal.properties)
    if (nameOf(m.name) === "props" && ts.isPropertyAssignment(m) && ts.isObjectLiteralExpression(m.initializer))
      for (const p of m.initializer.properties) {
        const pk = nameOf(p.name);
        if (pk) out.push(pk);
      }
  return out;
};

/**
 * The package-relative path a mixin specifier names, or null when it points
 * outside the package being checked. A package's own components import its
 * mixins through its public specifier (`@bootstrapp/light/components/mixins/x.js`), so
 * `selfPrefix` maps that back onto a readable path.
 * @param {string} spec
 * @param {string} fromFile
 * @param {string} selfPrefix
 * @returns {string | null}
 */
const mixinPath = (spec, fromFile, selfPrefix) => {
  if (spec.startsWith(".")) return path.posix.join(path.posix.dirname(fromFile), spec);
  if (selfPrefix && spec.startsWith(selfPrefix)) return spec.slice(selfPrefix.length);
  return null;
};

/**
 * Add to `into` every name the `mixins` fragments declare: their `properties`
 * keys and their members, following each fragment's own mixins.
 * @param {(rel: string) => string | null} read
 * @param {string} fromFile
 * @param {Array<{ spec: string, exported: string }>} mixins
 * @param {Set<string>} into
 * @param {string} [selfPrefix] the checked package's own specifier prefix, `@scope/name/`
 */
export const collectMixinNames = (read, fromFile, mixins, into, selfPrefix = "") => {
  for (const { spec, exported } of mixins) {
    const rel = mixinPath(spec, fromFile, selfPrefix);
    if (!rel) continue;
    const source = read(rel);
    if (!source) continue;
    const sf = sourceFile(source, rel);
    const literal = unwrapToLiteral(exportedInitializer(sf, exported));
    if (!literal) continue;
    for (const m of literal.properties) {
      const key = nameOf(m.name);
      if (key && key !== "props" && key !== "mixins") into.add(key);
    }
    for (const name of declaredPropertyNames(literal)) into.add(name);
    collectMixinNames(read, rel, mixinBindings(sf, literal), into, selfPrefix);
  }
};

/**
 * Add to `into` every name a component's `extends:` ancestry declares: the
 * base component's `properties` keys and its own members, following the chain.
 * A base is named by tag, so `sourceOf` resolves it through the component index.
 *
 * @param {(tag: string) => string | null} sourceOf
 * @param {string | null} tag
 * @param {Set<string>} into
 * @param {Set<string>} [seen]
 */
export const collectExtendsNames = (sourceOf, tag, into, seen = new Set()) => {
  if (!tag || seen.has(tag)) return;
  seen.add(tag);
  const source = sourceOf(tag);
  if (!source) return;
  const parsed = definitionOf(parseComponentSources(source, `${tag}.js`), tag);
  if (!parsed) return;
  for (const key of parsed.topLevelKeys) if (key !== "props" && key !== "mixins") into.add(key);
  for (const { name } of parsed.propertyNames) into.add(name);
  collectExtendsNames(sourceOf, parsed.extends, into, seen);
};
