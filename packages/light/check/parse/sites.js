/**
 * @bootstrapp/light/check/parse/sites.js: where a module defines components.
 * Its default export (a definition literal, or a call that takes one), and
 * every `View.define(...)` call on light's default import, in its five shapes:
 * a definition; a tag and a definition; a tag and a render function; a tag,
 * props and a definition; a tag, props and a render function.
 */

import * as ts from "typescript";
import { defaultExportExpression, defaultImportBinding, resolveLocal, unwrapParens, unwrapToLiteral } from "./ast.js";

/** @import { Expression, Node, SourceFile } from "typescript" */
/** @import { Site } from "../types.ts" */

const DEFINERS = new Set(["defineComponent", "defineMixin"]);

/** @param {string} spec */
const isLight = (spec) => spec === "@bootstrapp/light" || spec.endsWith("/view/index.js");

/**
 * Whether the literal behind `expr` is the definition itself. `unwrapToLiteral`
 * takes a call's last argument, which is the definition for
 * `defineComponent({...})` and the options for a component factory that builds
 * one (`editorFor({ tag, kind })`); in the second case the definition's own
 * keys sit in the factory's body, so a key missing from the literal says
 * nothing about whether the component declares it.
 * @param {Expression | null | undefined} expr
 */
const isDirectDefinition = (expr) => {
  const head = unwrapParens(expr);
  if (!head || !ts.isCallExpression(head)) return true;
  const callee = head.expression;
  return DEFINERS.has(ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "");
};

/** @param {Node | null} node */
const isFunction = (node) => !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

/**
 * @param {ts.CallExpression} call
 * @param {SourceFile} sf
 * @returns {Site | null}
 */
const defineSite = (call, sf) => {
  const args = call.arguments;
  if (!args.length) return null;
  const tagArg = args.length > 1 ? args[0] : null;
  const tag = tagArg && ts.isStringLiteralLike(tagArg) ? tagArg.text : null;
  const body = resolveLocal(args[args.length - 1]);
  const render = isFunction(body) ? body : null;
  const literal = render ? null : unwrapToLiteral(args[args.length - 1]);
  const propsArg = args.length > 2 ? resolveLocal(args[1]) : null;
  const props = propsArg && ts.isObjectLiteralExpression(propsArg) ? propsArg : null;
  if (!tag && !literal && !render) return null;
  return { tag, literal, props, render, offset: call.getStart(sf), direct: isDirectDefinition(body), defined: true };
};

/**
 * Every definition site of a module, in source order. A literal the default
 * export and a `View.define` call both reach is one site, the call's.
 * @param {SourceFile} sf
 * @returns {Site[]}
 */
export const definitionSites = (sf) => {
  /** @type {Site[]} */
  const sites = [];
  const local = defaultImportBinding(sf, isLight);
  if (local) {
    const visit = (/** @type {Node} */ node) => {
      if (ts.isFunctionLike(node) && node.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === local)) return;
      if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "define"
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === local
      ) {
        const site = defineSite(node, sf);
        if (site) sites.push(site);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const exported = defaultExportExpression(sf);
  const literal = unwrapToLiteral(exported);
  if (literal && !sites.some((site) => site.literal === literal))
    sites.push({ tag: null, literal, props: null, render: null, offset: literal.getStart(sf), direct: isDirectDefinition(exported), defined: false });
  return sites.sort((a, b) => a.offset - b.offset);
};
