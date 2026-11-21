import { defineRule } from "@lightstart/light/check/define.js";
import { icon } from "@lightstart/light/theme/icons.js";
import { collectionOf, scanIcons } from "../../node/icons.ts";

const SOURCE = /^src\/.*\.(?:js|ts)$/;

/** @param {import("@lightstart/light/check/types.ts").ProjectModel} ctx */
const setOf = (ctx) => {
  const source = ctx.code("src/app.ts") ?? ctx.code("src/app.js") ?? "";
  const match = /(?:^|[^a-zA-Z])icons\s*:\s*["']([^"']+)["']/.exec(source);
  return match?.[1] ?? "lucide";
};

/** @param {import("@lightstart/light/check/types.ts").ProjectModel} ctx */
const scansOf = (ctx) =>
  ctx
    .files()
    .filter((file) => SOURCE.test(file) && !/\.test\.(?:js|ts)$/.test(file))
    .map((file) => ({ file, scan: scanIcons(ctx.code(file) ?? "") }));

const IMPORT = /\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g;

/**
 * The project files `file` imports with a relative path, resolved against its folder.
 * @param {string} file
 * @param {string} source
 * @returns {string[]}
 */
const importsOf = (file, source) => {
  const dir = file.slice(0, file.lastIndexOf("/") + 1);
  const out = [];
  for (const match of source.matchAll(IMPORT)) {
    const parts = (dir + match[1]).split("/");
    const resolved = [];
    for (const part of parts) {
      if (part === "..") resolved.pop();
      else if (part !== ".") resolved.push(part);
    }
    out.push(resolved.join("/"));
  }
  return out;
};

export default defineRule({
  severity: "error",
  description: "an app's icons are known to its set, and its dynamic names are declared",
  why: "the generation writes a CSS mask for each icon name it finds, so a name the set does not have draws nothing, and a name built at run time is only in the page when a literal names it: in the module binding it, in a module it imports, or in a module-level `icons: [...]`; the npm set is what the masks are made from, so it has to be installed",
  check(ctx) {
    const scans = scansOf(ctx);
    const used = scans.filter(({ scan }) => scan.names.length > 0 || scan.dynamic.length > 0);
    if (used.length === 0) return;
    const named = new Set(scans.filter(({ scan }) => scan.names.length > 0).map(({ file }) => file));
    for (const { file, scan } of used) {
      if (scan.names.length > 0) continue;
      if (importsOf(file, ctx.code(file) ?? "").some((imported) => named.has(imported))) continue;
      for (const binding of scan.dynamic)
        ctx.report({
          file,
          line: binding.line,
          message: `the icon name \`${binding.expr}\` is an expression, and neither ${file} nor a module it imports names an icon; list the names it can take in a module-level \`icons: [...]\` so the build can ship their masks`,
        });
    }
    const set = setOf(ctx);
    const collection = collectionOf(ctx.projectDir, set);
    if (collection === null) {
      const first = used[0]?.file ?? "src/app.ts";
      ctx.report({ file: first, line: 1, message: `the app uses icons but @iconify-json/${set} is not installed; run \`pnpm add -D @iconify-json/${set}\`` });
      return;
    }
    for (const { file, scan } of used)
      for (const name of scan.names) {
        if (icon(collection, name) !== null) continue;
        ctx.report({ file, line: 1, message: `the icon "${name}" in ${file} is not in the "${set}" set; check the name or the app's \`icons\` set` });
      }
  },
});
