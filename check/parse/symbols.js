/**
 * The named code around a syntax node, as `Class.method`, `function`,
 * `const` or `Type`, so a finding can be named by `file#Symbol`: a key that
 * survives line moves, for the allowlists in the project's check config.
 */

import * as ts from "typescript";

/** @import { Node } from "typescript" */

/** @param {import("typescript").PropertyName | undefined} name */
const nameText = (name) => (name && (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) ? name.text : null);

/**
 * The name one node contributes to the chain: a class, a method or accessor,
 * a named function, a const holding a function, class or object, or a type.
 * @param {Node} node
 * @returns {string | null}
 */
const ownName = (node) => {
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return node.name?.text ?? null;
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isPropertyDeclaration(node)) return nameText(node.name);
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isFunctionDeclaration(node)) return node.name?.text ?? null;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isPropertyAssignment(node) && node.initializer && (ts.isFunctionExpression(node.initializer) || ts.isArrowFunction(node.initializer))) return nameText(node.name);
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return node.name.text;
  return null;
};

/**
 * The chain of names from the module down to `node`, outermost first:
 * `ChildPart.commit`, `measure`, `<module>` at the top level.
 * @param {Node} node
 * @returns {string}
 */
export const symbolOf = (node) => {
  /** @type {string[]} */
  const names = [];
  for (let at = /** @type {Node | undefined} */ (node); at; at = at.parent) {
    const name = ownName(at);
    if (name) names.unshift(name);
  }
  return names.join(".") || "<module>";
};

/**
 * Whether the file declares the symbol `chain` (`ChildPart.commit`).
 * @param {import("typescript").SourceFile} sf
 * @param {string} chain
 */
export const declaresSymbol = (sf, chain) => {
  let found = false;
  /** @param {Node} node */
  const visit = (node) => {
    if (found) return;
    if (ownName(node) !== null && symbolOf(node) === chain) found = true;
    else ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
};
