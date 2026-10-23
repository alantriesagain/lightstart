import { defineRule } from "../define.js";
import { declaresSymbol } from "../parse/symbols.js";
import { allowlist, isAllowed, parse, PERF_GATE, perfConfig } from "../perf.js";
import { find as findAny } from "./no-any.js";
import { find as findDelete } from "./perf-no-delete.js";
import { find as findRecordUnions } from "./perf-record-union.js";
import { find as findExceptionFlow } from "./perf-exception-flow.js";
import { find as findHotAllocations } from "./perf-hot-allocation.js";
import { find as findDeclaredFields } from "./perf-declared-fields.js";
import { find as findRecordDictionaries } from "./native-prefer-map.js";

/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

/** The rules whose findings an allowlist entry can cover, with what finds them. @type {Record<string, (ctx: ProjectModel) => Site[]>} */
const FINDERS = {
  "light/no-any": findAny,
  "light/perf-no-delete": findDelete,
  "light/perf-record-union": findRecordUnions,
  "light/perf-exception-flow": findExceptionFlow,
  "light/perf-hot-allocation": findHotAllocations,
  "light/perf-declared-fields": findDeclaredFields,
  "light/native-prefer-map": findRecordDictionaries,
};

/**
 * Why a `file` or `file#Symbol` key names nothing, or null when it names code that exists.
 * @param {ProjectModel} ctx
 * @param {string} key
 */
const unresolved = (ctx, key) => {
  const [file, symbol] = key.split("#");
  if (!file || !ctx.files().includes(file)) return `${file || key} is not a file in the project`;
  if (symbol && !declaresSymbol(parse(ctx, file), symbol)) return `${file} declares no ${symbol}`;
  return null;
};

export default defineRule({
  severity: "error",
  description: "the `perf` block's hot functions and every allowlist entry name code that exists, and every allowlist entry still covers a finding",
  why: "an entry that names a renamed function, or a site that has since been fixed, silently stops meaning anything; reporting it keeps the allowlist a true list of the exceptions",
  appliesTo: PERF_GATE,
  check(ctx) {
    const perf = perfConfig(ctx);
    if (!perf) return;
    const manifest = ctx.read("package.json") ?? "";
    /** @param {string} key @param {string} message */
    const report = (key, message) => {
      const at = manifest.indexOf(JSON.stringify(key));
      ctx.report({ file: "package.json", offset: at < 0 ? 0 : at, message });
    };
    for (const entry of perf.hot)
      if (!entry.includes("#")) report(entry, `hot entry ${entry} needs a symbol: file#Class.method`);
      else {
        const problem = unresolved(ctx, entry);
        if (problem) report(entry, `hot entry ${entry}: ${problem}`);
      }

    for (const [ruleId, find] of Object.entries(FINDERS)) {
      const allowed = allowlist(ctx, ruleId);
      const keys = Object.keys(allowed);
      if (!keys.length) continue;
      const sites = find(ctx);
      for (const key of keys) {
        const problem = unresolved(ctx, key);
        if (problem) report(key, `${ruleId} allows ${key}: ${problem}`);
        else if (!allowed[key]) report(key, `${ruleId} allows ${key} without a reason`);
        else if (!sites.some((site) => isAllowed({ [key]: allowed[key] }, site))) report(key, `${ruleId} allows ${key}, but the rule reports nothing there any more: remove the entry`);
      }
    }
  },
});
