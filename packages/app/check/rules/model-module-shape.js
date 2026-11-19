import { defineRule } from "@lightstart/light/check/define.js";
import { defaultExportExpression, resolveLocal, sourceFile } from "@lightstart/light/check/parse/ast.js";
import ts from "@lightstart/light/check/parse/typescript.js";
import path from "node:path";

const MODEL_FILE = /^src\/models\/([^/]+)\.(js|ts)$/;

/** @param {string} file */
const modelName = (file) => MODEL_FILE.exec(file)?.[1] ?? null;

/** @param {import("typescript").Expression} expression */
const defineModelName = (expression) => {
  if (!ts.isCallExpression(expression)) return null;
  const callee = expression.expression;
  const named = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
  if (named !== "defineModel") return null;
  const first = expression.arguments[0];
  return first && ts.isStringLiteral(first) ? first.text : null;
};

export default defineRule({
  severity: "error",
  description: "a model module default-exports defineModel(...) under the module's own name",
  why: "the generation and the store read a model by the file it lives in, so a module that exports something else, or a model whose name differs from its file, leaves the app with a model list that does not match its files",
  check(ctx) {
    for (const file of ctx.files()) {
      const expected = modelName(file);
      if (!expected || /\.test\.(js|ts)$/.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      const sf = sourceFile(source, file);
      const exported = defaultExportExpression(sf);
      if (!exported) {
        ctx.report({ file, offset: 0, message: `${file} has no default export; it default-exports \`defineModel("${expected}", ...)\`` });
        continue;
      }
      const resolved = resolveLocal(exported);
      const name = resolved ? defineModelName(resolved) : null;
      if (resolved === null || name === null) {
        ctx.report({ file, offset: exported.getStart(sf), message: `${file} does not default-export \`defineModel(...)\`; a model module exports the model it defines` });
        continue;
      }
      if (name !== expected)
        ctx.report({ file, offset: resolved.getStart(sf), message: `defineModel is called with "${name}" but the file is ${path.posix.basename(file)}; the model's name is its file's name ("${expected}")` });
    }
  },
});
