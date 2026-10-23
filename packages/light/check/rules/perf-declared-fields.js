import * as ts from "typescript";
import { defineRule } from "../define.js";
import { filesIn, parse, PERF_GATE, perfConfig, reportSites, siteAt } from "../perf.js";

/** @import { ClassLikeDeclaration, Node } from "typescript" */
/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/perf-declared-fields";

/**
 * The property `node` assigns on `this` (`this.x = …`, `this.x ??= …`), or null.
 * @param {Node} node
 */
const thisAssignment = (node) => {
  if (!ts.isBinaryExpression(node)) return null;
  const kind = node.operatorToken.kind;
  if (kind < ts.SyntaxKind.FirstAssignment || kind > ts.SyntaxKind.LastAssignment) return null;
  const target = node.left;
  return ts.isPropertyAccessExpression(target) && target.expression.kind === ts.SyntaxKind.ThisKeyword && ts.isIdentifier(target.name) ? target.name : null;
};

/**
 * The fields a class gives every instance from the start: declared fields and those its constructor assigns.
 * @param {ClassLikeDeclaration} cls
 */
const declaredFields = (cls) => {
  /** @type {Set<string>} */
  const names = new Set();
  for (const member of cls.members) {
    if (ts.isPropertyDeclaration(member) && member.name && (ts.isIdentifier(member.name) || ts.isPrivateIdentifier(member.name))) names.add(member.name.text);
    if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member) || ts.isMethodDeclaration(member))
      if (member.name && ts.isIdentifier(member.name)) names.add(member.name.text);

    if (ts.isConstructorDeclaration(member) && member.body) {
      /** @param {Node} node */
      const visit = (node) => {
        const name = thisAssignment(node);
        if (name) names.add(name.text);
        if (!ts.isFunctionLike(node) || node === member) ts.forEachChild(node, visit);
      };
      visit(member.body);
    }
  }
  return names;
};

/**
 * Every assignment, in a JavaScript class's methods, to an instance property the class neither declares nor sets in its constructor.
 * @param {ProjectModel} ctx
 * @returns {Site[]}
 */
export const find = (ctx) => {
  const perf = perfConfig(ctx);
  if (!perf) return [];
  /** @type {Site[]} */
  const sites = [];
  for (const file of filesIn(ctx, perf.scope).filter((name) => name.endsWith(".js"))) {
    const sf = parse(ctx, file);
    /** @param {Node} node */
    const visit = (node) => {
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const fields = declaredFields(node);
        const reported = new Set();
        for (const member of node.members) {
          if (ts.isConstructorDeclaration(member) || ts.isPropertyDeclaration(member)) continue;
          /** @param {Node} inner */
          const scan = (inner) => {
            const name = thisAssignment(inner);
            if (name && !fields.has(name.text) && !reported.has(name.text)) {
              reported.add(name.text);
              sites.push(siteAt(file, sf, inner, `${name.text} is added to instances after construction: V8 gives each such instance a new hidden class, and reads of it see several shapes. Declare it as a class field`));
            }
            if (!ts.isClassLike(inner)) ts.forEachChild(inner, scan);
          };
          ts.forEachChild(member, scan);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "a JavaScript class declares every instance property it later assigns",
  why: "under V8, adding a property after construction changes the instance's hidden class, so objects of one class end up with several shapes; TypeScript classes must declare their fields already",
  appliesTo: PERF_GATE,
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
