import { defineRule } from "@lightstart/light/check/define.js";

const LOCALE_FILE = /^locales\/[^/]+\.js$/;

/** @param {string} file */
const isLocaleFile = (file) => LOCALE_FILE.test(file) && !file.endsWith(".test.js");

/** @param {import("@lightstart/light/check/types.ts").ProjectModel} ctx */
const hasLocaleFile = (ctx) => ctx.files().some(isLocaleFile);

/** @param {import("@lightstart/light/check/types.ts").CheckContext} ctx */
const checkLocaleImports = (ctx) => {
  for (const file of ctx.files()) {
    if (!isLocaleFile(file)) continue;
    for (const { spec, offset } of ctx.imports(file))
      ctx.report({
        file,
        offset,
        message: `a locale file imports "${spec}"; a locale is plain data, so inline the value here, or ship shared words from a package that declares \`light.locales: true\``,
      });
  }
};

export default defineRule({
  severity: "error",
  description: "a locale file is plain data and imports nothing",
  why: "a locale is assembled from every file that declares it, package first and project last, and the build folds those into one file per language; an import inside a locale file reaches around that order, and it stops the file being read where no module loader follows it, such as a server rendering a line or a test reading the tree",
  appliesTo: { when: hasLocaleFile },
  check: checkLocaleImports,
});
