import { defineRule } from "@lightstart/light/check/define.js";
import { sourceFile } from "@lightstart/light/check/parse/ast.js";
import ts from "@lightstart/light/check/parse/typescript.js";
import path from "node:path";

const WRITES = new Set(["add", "addMany", "edit", "remove", "removeAll"]);

/** @param {string} file @param {string} spec */
const resolvesToModel = (file, spec) => {
  if (!spec.startsWith(".")) return false;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  return /^src\/models\/[^/]+\.(js|ts)$/.test(target);
};

export default defineRule({
  severity: "error",
  description: "a view writes no model; it goes through its controller",
  why: "a view renders what a controller reads, and a write starts somewhere a keyboard or a click reached, so a view calling a model's add, edit or remove skips the controller's validation, its sync and the events the rest of the app follows",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!/^src\/views\/.*\.(js|ts)$/.test(file) || /\.test\.(js|ts)$/.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      const sf = sourceFile(source, file);
      /** @type {Set<string>} */
      const models = new Set();
      for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        if (!resolvesToModel(file, statement.moduleSpecifier.text)) continue;
        const clause = statement.importClause;
        if (!clause || clause.isTypeOnly) continue;
        if (clause.name) models.add(clause.name.text);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const element of bindings.elements) if (!element.isTypeOnly) models.add(element.name.text);
        if (bindings && ts.isNamespaceImport(bindings)) models.add(bindings.name.text);
      }
      if (!models.size) continue;
      /** @param {import("typescript").Node} node */
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const access = node.expression;
          if (ts.isIdentifier(access.expression) && models.has(access.expression.text) && WRITES.has(access.name.text))
            ctx.report({
              file,
              offset: access.getStart(sf),
              message: `\`${access.expression.text}.${access.name.text}(...)\` writes the model from inside a view; call a method on the view's controller instead`,
            });
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  },
});
