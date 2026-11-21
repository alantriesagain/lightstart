import { defineRule } from "@lightstart/light/check/define.js";
import { icon } from "@lightstart/light/theme/icons.js";
import { collectionOf, ownIcons, scanIcons, svgProblems } from "../../node/icons.ts";

const SOURCE = /^src\/.*\.(?:js|ts)$/;
const ICON_FILE = /^icons\/.+\.svg$/;
const ICON_NAME = /^[a-z][a-z0-9-]*$/;

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

export default defineRule({
  severity: "error",
  description: "an app's icons are known to its set or its icons/ folder, and its dynamic names have names to take",
  why: "the generation writes a CSS mask for each icon name it finds, so a name the set does not have draws nothing, and a name built at run time is only in the page when a literal somewhere names it or it is one of the app's own icons; which literal a binding takes is only known on the page, where lc-icon warns for a name no stylesheet draws; the npm set is what the masks are made from, so it has to be installed",
  check(ctx) {
    const own = ownIcons(ctx.projectDir);
    const appIcons = new Set(own.map((item) => item.name));
    for (const file of ctx.assetFiles("icons").filter((path) => ICON_FILE.test(path))) {
      const name = file.slice(file.lastIndexOf("/") + 1, -".svg".length);
      if (!ICON_NAME.test(name))
        ctx.report({ file, line: 1, message: `the icon file ${file} is named "${name}", which is not a lower-case kebab-case icon name` });
      for (const problem of svgProblems(ctx.read(file) ?? "")) ctx.report({ file, line: 1, message: `the icon file ${file} ${problem}` });
    }
    const scans = scansOf(ctx);
    const drawnNames = (/** @type {import("../../node/icons.ts").ScannedIcons} */ scan) => scan.names.filter((name) => !scan.properties.includes(name));
    const used = scans.filter(({ scan }) => drawnNames(scan).length > 0 || scan.dynamic.length > 0);
    const namesAnywhere = appIcons.size > 0 || scans.some(({ scan }) => scan.names.length > 0);
    if (!namesAnywhere)
      for (const { file, scan } of used)
        for (const binding of scan.dynamic)
          ctx.report({
            file,
            line: binding.line,
            message: `the icon name \`${binding.expr}\` is an expression, and the app names no icon anywhere for it to take; write the names as literals (in a list, in data or in a module-level \`icons: [...]\`) or add the app's own in icons/, so the build can ship their masks`,
          });
    const set = setOf(ctx);
    const collection = collectionOf(ctx.projectDir, set);
    const drawn = new Set(used.flatMap(({ scan }) => drawnNames(scan)));
    if (collection === null) {
      if (used.length === 0 || (appIcons.size > 0 && [...drawn].every((name) => appIcons.has(name)))) return;
      const first = used[0]?.file ?? "src/app.ts";
      ctx.report({ file: first, line: 1, message: `the app uses icons but @iconify-json/${set} is not installed; run \`pnpm add -D @iconify-json/${set}\`` });
      return;
    }
    for (const item of own)
      if (icon(collection, item.name) !== null)
        ctx.report({
          file: item.file,
          line: 1,
          message: `the app icon "${item.name}" in ${item.file} shadows the "${set}" icon of the same name; rename one of them`,
        });
    for (const { file, scan } of used)
      for (const name of drawnNames(scan)) {
        if (appIcons.has(name) || icon(collection, name) !== null) continue;
        ctx.report({ file, line: 1, message: `the icon "${name}" in ${file} is not in the "${set}" set or the app's icons/ folder; check the name` });
      }
  },
});
