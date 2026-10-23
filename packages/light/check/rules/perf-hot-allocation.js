import * as ts from "typescript";
import { defineRule } from "../define.js";
import { parse, PERF_GATE, perfConfig, reportSites, siteAt } from "../perf.js";
import { symbolOf } from "../parse/symbols.js";

/** @import { Node, SourceFile } from "typescript" */
/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/perf-hot-allocation";

/** @param {Node} node */
const calleeName = (node) => (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null);

/** @param {Node} node */
const calleeObject = (node) => (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) ? node.expression.expression.text : null);

/**
 * Whether a function is the one a declaration names (`const measure = () => …`, `run = () => …` as a field), not one made inside it.
 * @param {Node} node
 */
const isDeclared = (node) => {
  const parent = node.parent;
  return !!parent && (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertyAssignment(parent)) && parent.initializer === node;
};

/**
 * What an expression allocates on every run, or null.
 * @param {Node} node
 * @returns {string | null}
 */
const allocation = (node) => {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return "a closure";
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Promise") return "a Promise";
  if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) return "a spread copy";
  if (ts.isCallExpression(node)) {
    const object = calleeObject(node);
    const name = calleeName(node);
    if (object === "Array" && name === "from") return "an Array.from copy";
    if (object === "Object" && (name === "keys" || name === "values" || name === "entries")) return `an Object.${name} array`;
    if (name === "slice" && node.arguments.length === 0) return "a slice() copy";
    if (name === "map" || name === "filter") return `a .${name}() array`;
  }
  return null;
};

/**
 * Every allocation inside the functions the `perf` block lists as hot.
 * @param {ProjectModel} ctx
 * @returns {Site[]}
 */
export const find = (ctx) => {
  const perf = perfConfig(ctx);
  if (!perf) return [];
  /** @type {Map<string, string[]>} */
  const hotByFile = new Map();
  for (const entry of perf.hot) {
    const [file, symbol] = entry.split("#");
    if (!file || !symbol) continue;
    hotByFile.set(file, [...(hotByFile.get(file) ?? []), symbol]);
  }
  /** @type {Site[]} */
  const sites = [];
  for (const [file, symbols] of hotByFile) {
    if (!ctx.files().includes(file)) continue;
    const sf = /** @type {SourceFile} */ (parse(ctx, file));
    /** @param {Node} node */
    const visit = (node) => {
      const what = allocation(node);
      if (what) {
        const symbol = symbolOf(node);
        const hot = symbols.find((name) => (symbol === name && !(what === "a closure" && isDeclared(node))) || symbol.startsWith(`${name}.`));
        if (hot) sites.push(siteAt(file, sf, node, `${what} on every call of ${hot}, which the perf block lists as hot`));
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "no per-call allocations (closures, copies, Promises, key arrays) inside the functions the `perf` block lists as hot",
  why: "natively every allocation is a call to the allocator and a release; under V8 it is garbage for the next scavenge. In a function that runs per node, per item or per frame it adds up",
  appliesTo: PERF_GATE,
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
