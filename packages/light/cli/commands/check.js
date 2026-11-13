import path from "node:path";
import { defineCommand } from "@lightstart/cli";
import { checkTarget } from "../../check/cli.js";

/** @import { CheckExtension, CheckInfo, CheckInput } from "../extensions.ts" */
/** @import { ProjectContext, RuleSource } from "../../check/types.ts" */

export default defineCommand({
  description: "Check a project's component files against light's conventions",
  args: {
    root: { description: "The project root (default: the nearest package.json above each target)" },
    rule: { description: "Run one rule by id" },
    json: { flag: true, description: "Print the result as JSON" },
    targets: { positional: true, rest: true, description: "Each folder to check (default: the current folder)" },
  },
  async run(ctx, args) {
    const targets = args.targets.length > 0 ? args.targets.map((target) => path.resolve(target)) : [ctx.cwd];
    const root = args.root === undefined ? null : path.resolve(args.root);
    const rule = args.rule;
    const json = args.json;
    /** @type {RuleSource[]} */
    const extraSources = [];
    /** @type {Array<(sources: RuleSource[]) => RuleSource[]>} */
    const sourceWraps = [];
    /** @type {Array<(context: ProjectContext, info: CheckInfo) => ProjectContext>} */
    const wraps = [];
    /** @type {Array<(input: CheckInput) => Promise<boolean> | boolean>} */
    const replacements = [];
    /** @type {CheckExtension} */
    const api = {
      sources(add) {
        sourceWraps.push(add);
      },
      addSources(...sources) {
        extraSources.push(...sources);
      },
      context(wrap) {
        wraps.push(wrap);
      },
      run(fn) {
        replacements.push(fn);
      },
    };
    /** @param {string} dir */
    const runOnce = async (dir) => checkTarget({ dir, root, rule, json, extraSources, sourceWraps, wraps });
    await ctx.cli.extend("check", api);
    if (replacements.length > 0) return (await replacements[0]({ targets, root, rule, json, runOnce })) ? 0 : 1;
    let passed = true;
    for (const target of targets) if (!(await runOnce(target))) passed = false;
    return passed ? 0 : 1;
  },
});
