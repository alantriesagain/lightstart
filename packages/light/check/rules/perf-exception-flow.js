import * as ts from "typescript";
import { defineRule } from "../define.js";
import { filesIn, parse, PERF_GATE, perfConfig, reportSites, siteAt } from "../perf.js";

/** @import { Node } from "typescript" */
/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/perf-exception-flow";

/** @param {Node} node */
const isFunctionBoundary = (node) => ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node);

/**
 * The `try` whose block holds `node`, if one holds it before a function boundary and has a `catch`.
 * @param {Node} node
 * @returns {import("typescript").TryStatement | null}
 */
const catchingTry = (node) => {
  for (let child = node, at = node.parent; at; child = at, at = at.parent) {
    if (isFunctionBoundary(at)) return null;
    if (ts.isTryStatement(at) && at.tryBlock === child && at.catchClause) return at;
  }
  return null;
};

/**
 * Every `throw` caught in the same function, and every `JSON.parse` whose failure a `catch` turns into a value.
 * @param {ProjectModel} ctx
 * @returns {Site[]}
 */
export const find = (ctx) => {
  const perf = perfConfig(ctx);
  if (!perf) return [];
  /** @type {Site[]} */
  const sites = [];
  for (const file of filesIn(ctx, perf.scope)) {
    const sf = parse(ctx, file);
    /** @param {Node} node */
    const visit = (node) => {
      if (ts.isThrowStatement(node) && catchingTry(node))
        sites.push(siteAt(file, sf, node, "this throw is caught in the same function: an exception used as control flow. Under V8 creating an Error records the stack (20x slower in the measured pair); branch instead"));
      else if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "JSON" &&
        node.expression.name.text === "parse" &&
        catchingTry(node)
      )
        sites.push(siteAt(file, sf, node, "JSON.parse whose failure the catch turns into a fallback: if the input is often not JSON, every such read throws. Check the input before parsing"));
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "no exceptions as control flow: a throw caught in the same function, or JSON.parse failing over to a fallback",
  why: "measured: returning a value instead of throwing was faster under both engines, 20x under V8 (stack capture) and 1.6x natively",
  appliesTo: PERF_GATE,
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
