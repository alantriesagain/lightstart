import { defineRule } from "@lightstart/light/check/define.js";
import { sourceFile } from "@lightstart/light/check/parse/ast.js";
import ts from "@lightstart/light/check/parse/typescript.js";

const GLOBALS = new Set(["document", "window"]);
const TEST_FILE = /^tests?\/.*\.(?:test|e2e)\.(js|ts)$/;

/** @param {string} file */
const isBrowserTest = (file) => /\.browser\.test\.(js|ts)$/.test(file) || /\.e2e\.(js|ts)$/.test(file);

/**
 * Whether an identifier is a property name, a declaration name, a parameter or
 * an import binding rather than a free reference.
 * @param {import("typescript").Node} node
 */
const isName = (node) => {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;
  if ((ts.isClassDeclaration(parent) || ts.isClassExpression(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent) || ts.isImportEqualsDeclaration(parent)) return true;
  return false;
};

/**
 * Every name the file declares as a local variable, parameter or other binding.
 * @param {import("typescript").SourceFile} sf
 * @returns {Set<string>}
 */
const declaredNames = (sf) => {
  /** @type {Set<string>} */
  const names = new Set();
  /** @param {import("typescript").BindingName} name */
  const collect = (name) => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else for (const element of name.elements) if (!ts.isOmittedExpression(element)) collect(element.name);
  };
  /** @param {import("typescript").Node} node */
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) collect(node.name);
    else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.add(node.name.text);
    else if (ts.isCatchClause(node) && node.variableDeclaration) collect(node.variableDeclaration.name);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
};

export default defineRule({
  severity: "warn",
  description: "a test that touches the DOM is named *.browser.test.* or *.e2e.*",
  why: "a plain test runs under node and natively, where document and window do not exist; the name tells the runner which tests it must open in a browser, so a test reading them without it either crashes or is silently left out",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!TEST_FILE.test(file) || isBrowserTest(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      const sf = sourceFile(source, file);
      const locals = declaredNames(sf);
      /** @param {import("typescript").Node} node */
      const visit = (node) => {
        if (ts.isIdentifier(node) && GLOBALS.has(node.text) && !isName(node) && !locals.has(node.text)) {
          ctx.report({ file, offset: node.getStart(sf), message: `touches \`${node.text}\` outside a *.browser.test.* or *.e2e.* file; name it for the browser or move the DOM work behind a page helper` });
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  },
});
