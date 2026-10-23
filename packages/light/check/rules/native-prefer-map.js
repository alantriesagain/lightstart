import * as ts from "typescript";
import { defineRule } from "../define.js";
import { filesIn, parse, PERF_GATE, perfConfig, reportSites, siteAt } from "../perf.js";

/** @import { Node, SourceFile, TypeNode } from "typescript" */
/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/native-prefer-map";

/**
 * Whether a type annotation is a string-keyed dictionary: `Record<string, T>` or `{ [key: string]: T }`.
 * @param {TypeNode | undefined} type
 */
const isDictionaryType = (type) => {
  if (!type) return false;
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === "Record") {
    const key = type.typeArguments?.[0];
    return key !== undefined && key.kind === ts.SyntaxKind.StringKeyword;
  }
  if (ts.isTypeLiteralNode(type)) return type.members.length === 1 && ts.isIndexSignatureDeclaration(type.members[0]) && type.members[0].parameters[0]?.type?.kind === ts.SyntaxKind.StringKeyword;
  return false;
};

/** The expression a value reaches through parentheses and type assertions. @param {Node} node */
const outerExpression = (node) => {
  let at = node;
  while (at.parent && (ts.isParenthesizedExpression(at.parent) || ts.isAsExpression(at.parent) || ts.isSatisfiesExpression(at.parent) || ts.isNonNullExpression(at.parent) || ts.isTypeAssertionExpression(at.parent))) at = at.parent;
  return at;
};

/**
 * Whether a use of a binding hands the object to other code: returned, passed to a call other than `Object.*`, stored in another object, array or binding.
 * @param {Node} use
 */
const escapes = (use) => {
  const at = outerExpression(use);
  const parent = at.parent;
  if (!parent) return false;
  if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === at)) return true;
  if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.arguments?.includes(/** @type {import("typescript").Expression} */ (at))) {
    const callee = parent.expression;
    return !(ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "Object");
  }
  if (ts.isShorthandPropertyAssignment(parent) || (ts.isPropertyAssignment(parent) && parent.initializer === at) || ts.isArrayLiteralExpression(parent) || ts.isSpreadElement(parent)) return true;
  if (ts.isVariableDeclaration(parent) && parent.initializer === at) return true;
  return ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === at;
};

/**
 * The names in a file declared with a dictionary type that stay inside the code that made them: variables never returned or passed on, and properties (as `this.name`). A parameter is the caller's object, and one that escapes is data handed to other code; changing either to a Map changes an interface, so neither is reported.
 * @param {SourceFile} sf
 */
const dictionaries = (sf) => {
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {Set<string>} */
  const escaped = new Set();
  /** @param {Node} node */
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isDictionaryType(node.type)) names.add(node.name.text);
    if (ts.isPropertyDeclaration(node) && node.name && ts.isIdentifier(node.name) && isDictionaryType(node.type)) names.add(`this.${node.name.text}`);
    if (ts.isIdentifier(node) && !(ts.isVariableDeclaration(node.parent) && node.parent.name === node) && escapes(node)) escaped.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  for (const name of escaped) names.delete(name);
  return names;
};

/** The binding an expression names, as the dictionaries set spells it. @param {Node} node */
const bindingOf = (node) => {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) return `this.${node.name.text}`;
  return null;
};

/** @param {Node} key */
const isLiteralKey = (key) => ts.isStringLiteralLike(key) || ts.isNumericLiteral(key);

/**
 * Every write, `in` test or `delete` with a computed key on a dictionary-typed binding, in native code.
 * @param {ProjectModel} ctx
 * @returns {Site[]}
 */
export const find = (ctx) => {
  const perf = perfConfig(ctx);
  if (!perf) return [];
  /** @type {Site[]} */
  const sites = [];
  for (const file of filesIn(ctx, perf.native).filter((name) => name.endsWith(".ts"))) {
    const sf = parse(ctx, file);
    const names = dictionaries(sf);
    if (!names.size) continue;
    /** @param {Node} node */
    const visit = (node) => {
      /** @type {Node | null} */
      let target = null;
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ts.isElementAccessExpression(node.left) && !isLiteralKey(node.left.argumentExpression))
        target = node.left.expression;
      else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword && !isLiteralKey(node.left)) target = node.right;
      else if (ts.isDeleteExpression(node) && ts.isElementAccessExpression(node.expression) && !isLiteralKey(node.expression.argumentExpression)) target = node.expression.expression;
      const name = target ? bindingOf(target) : null;
      if (name && names.has(name))
        sites.push(siteAt(file, sf, node, `${name} is a Record used as a dictionary: natively, keys are looked up as strings and a missing key's read boxes the result. A Map was 4x faster natively in the measured pair, but V8 can prefer the Record: measure both before changing it`));
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "in code that compiles natively, a string-keyed dictionary that stays inside the code that made it is a Map rather than a Record written with computed keys",
  why: "measured: counting words in a Map was 4x faster natively than in a Record<string, number>, and somewhat slower under V8, so each site needs a measurement",
  appliesTo: PERF_GATE,
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
