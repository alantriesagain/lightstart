import { defineRule } from "../define.js";
import { anyOffsets, suppressionOffsets } from "../parse/any.js";
import { isSource, isTestFile, parse, reportSites } from "../perf.js";
import { symbolOf } from "../parse/symbols.js";
import * as ts from "typescript";

/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/no-any";

/** @param {ProjectModel} ctx @returns {{ tests: boolean } | null} */
const noAnyConfig = (ctx) => {
  const check = /** @type {unknown} */ (ctx.config?.check);
  const block = check && typeof check === "object" ? /** @type {Record<string, unknown>} */ (check).noAny : undefined;
  if (!block || typeof block !== "object") return null;
  return { tests: /** @type {Record<string, unknown>} */ (block).tests === true };
};

/**
 * Every `any` and every comment that switches type checking off, in the files the rule reads.
 * @param {ProjectModel} ctx
 * @returns {Site[]}
 */
export const find = (ctx) => {
  const config = noAnyConfig(ctx);
  if (!config) return [];
  /** @type {Site[]} */
  const sites = [];
  for (const file of ctx.files()) {
    if (!isSource(file) || (!config.tests && isTestFile(file))) continue;
    const sf = parse(ctx, file);
    /** @param {number} offset */
    const nodeAt = (offset) => {
      /** @type {import("typescript").Node} */
      let found = sf;
      /** @param {import("typescript").Node} node */
      const visit = (node) => {
        if (node.pos <= offset && offset < node.end) {
          found = node;
          ts.forEachChild(node, visit);
        }
      };
      ts.forEachChild(sf, visit);
      return found;
    };
    /** @param {number} offset @param {string} message */
    const site = (offset, message) => ({ file, offset, symbol: symbolOf(nodeAt(offset)), message });
    for (const offset of anyOffsets(sf)) sites.push(site(offset, "`any` switches type checking off for this value: use the precise type, or `unknown` and narrow it"));
    for (const offset of suppressionOffsets(sf)) sites.push(site(offset, "a @ts-ignore or @ts-nocheck hides type errors instead of fixing them"));
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "no `any` in a type, JSDoc or TypeScript, and no @ts-ignore or @ts-nocheck (opt in with a `noAny` block under bootstrapp.check)",
  why: "`any` turns off checking for everything it touches and spreads through inference; natively it also compiles to a dynamic value, checked at run time on every use",
  appliesTo: { when: (ctx) => noAnyConfig(/** @type {ProjectModel} */ (ctx)) !== null },
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
