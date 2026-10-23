import * as ts from "typescript";
import { defineRule } from "../define.js";
import { filesIn, parse, PERF_GATE, perfConfig, reportSites, siteAt } from "../perf.js";

/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/perf-no-delete";
const MESSAGE = "`delete` gives the object a new shape: V8 moves it to slow dictionary properties for the rest of its life. Assign undefined, or keep keys that come and go in a Map";

/**
 * Every `delete` and `Reflect.deleteProperty` in the files in scope.
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
    /** @param {import("typescript").Node} node */
    const visit = (node) => {
      if (ts.isDeleteExpression(node)) sites.push(siteAt(file, sf, node, MESSAGE));
      else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "Reflect" && node.expression.name.text === "deleteProperty")
        sites.push(siteAt(file, sf, node, MESSAGE));
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "no `delete` on objects in the code the `perf` block covers",
  why: "measured on V8: deleting a property switches the object to dictionary mode, and assigning undefined keeps it fast (8x on the delete pair); scriptc compiles both to the same store",
  appliesTo: PERF_GATE,
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
