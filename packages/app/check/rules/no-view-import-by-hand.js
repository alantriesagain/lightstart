import { defineRule } from "@lightstart/light/check/define.js";
import { sourceFile } from "@lightstart/light/check/parse/ast.js";
import ts from "@lightstart/light/check/parse/typescript.js";
import path from "node:path";

/** @param {string} file @param {string} spec */
const resolvesToView = (file, spec) => {
  if (!spec.startsWith(".")) return false;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  return /^src\/views\/[^/]+\.(js|ts)$/.test(target);
};

/**
 * The local name of every binding an import clause introduces.
 * @param {import("typescript").ImportClause} clause
 * @returns {string[]}
 */
const bindingNames = (clause) => {
  /** @type {string[]} */
  const names = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) names.push(element.name.text);
  else if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
  return names;
};

export default defineRule({
  severity: "error",
  description: "a module never imports a view by hand only to make its tag exist; .light/ defines the views",
  why: "the generation imports every view under src/views/, so a side-effect import of one, or an import whose bindings nothing uses, either defines it twice or hides which modules the generation owns; a named or default import that is used is a normal module dependency, and `import type` is exempt",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!/^src\/.*\.(js|ts)$/.test(file) || /\.test\.(js|ts)$/.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      const sf = sourceFile(source, file);
      /** @type {Set<string>} */
      const used = new Set();
      /** @param {import("typescript").Node} node */
      const visit = (node) => {
        if (ts.isImportDeclaration(node)) return;
        if (ts.isIdentifier(node)) used.add(node.text);
        ts.forEachChild(node, visit);
      };
      for (const statement of sf.statements) if (!ts.isImportDeclaration(statement)) visit(statement);
      for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const spec = statement.moduleSpecifier.text;
        if (!resolvesToView(file, spec)) continue;
        const clause = statement.importClause;
        if (clause?.isTypeOnly) continue;
        const names = clause ? bindingNames(clause) : [];
        if (names.some((name) => used.has(name))) continue;
        ctx.report({ file, offset: statement.getStart(sf), message: `imports the view module "${spec}" only for its side effect; .light/ defines every view under src/views/, so use the bindings you import or import it with \`import type\` for its types` });
      }
    }
  },
});
