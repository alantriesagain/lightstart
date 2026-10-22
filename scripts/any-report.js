/**
 * Where an `any` starts in light's typed code: a declaration the checker
 * types `any`, a call that returns one, or a member read off a typed value
 * that answers one. A value read from an `any` it was handed is not counted
 * again, so each line names a source to fix. The explicit `any` in a type is
 * `light/no-any`'s to report; this finds what flows in without one, from an
 * untyped `Map`, a lib member or a `let` with no type. The target of an
 * assignment is a write, not a read, and is not counted.
 *
 *   node scripts/any-report.js            every origin, by file; exits 1 if any
 *   node scripts/any-report.js --list     one line per origin
 *   node scripts/any-report.js dom/ html/ only these files and folders
 *
 * It reads the program of the root tsconfig, so tests are left out as the
 * typecheck leaves them. The scriptc probes under native/probes/ are left out
 * too: they exercise what scriptc compiles, dynamic code included.
 */

import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const LIGHT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEFT_OUT = ["node_modules/", ".bootstrapp/", "native/probes/"];

/** @import { Node, SourceFile, TypeChecker } from "typescript" */

/**
 * @typedef {object} Origin
 * @property {string} file
 * @property {number} line
 * @property {number} col
 * @property {"declared" | "returned" | "read"} kind
 * @property {string} text
 */

const args = process.argv.slice(2);
const listing = args.includes("--list");
const only = args.filter((arg) => !arg.startsWith("--"));

const parsed = ts.getParsedCommandLineOfConfigFile(join(LIGHT, "tsconfig.json"), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  },
});
if (!parsed) throw new Error("tsconfig.json did not parse");
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();

/** @param {TypeChecker} types @param {Node} node */
const isAny = (types, node) => (types.getTypeAtLocation(node).flags & ts.TypeFlags.Any) !== 0;

/**
 * The kind of `any` a node starts, or null when it starts none.
 * @param {Node} node
 * @returns {Origin["kind"] | null}
 */
const originKind = (node) => {
  if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && isAny(checker, node.name)) return "declared";
  if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && !isAny(checker, node.expression) && isAny(checker, node)) return "returned";
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null;
  const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
  const written = ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  return !called && !written && !isAny(checker, node.expression) && isAny(checker, node) ? "read" : null;
  return null;
};

/** @param {string} file */
const inScope = (file) => !file.startsWith("..") && !LEFT_OUT.some((prefix) => file.startsWith(prefix)) && (only.length === 0 || only.some((path) => (path.endsWith("/") ? file.startsWith(path) : file === path)));

/** @type {Origin[]} */
const origins = [];
for (const sf of program.getSourceFiles()) {
  const file = relative(LIGHT, sf.fileName);
  if (sf.isDeclarationFile || !inScope(file)) continue;
  /** @param {SourceFile} source @param {Node} node */
  const visit = (source, node) => {
    const kind = originKind(node);
    if (kind) {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
      origins.push({ file, line: line + 1, col: character + 1, kind, text: node.getText(source).replace(/\s+/g, " ").slice(0, 80) });
    }
    ts.forEachChild(node, (child) => visit(source, child));
  };
  visit(sf, sf);
}

if (listing) for (const origin of origins) console.log(`${origin.file}:${origin.line}:${origin.col} ${origin.kind} ${origin.text}`);
else {
  /** @type {Map<string, number>} */
  const byFile = new Map();
  for (const origin of origins) byFile.set(origin.file, (byFile.get(origin.file) ?? 0) + 1);
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) console.log(`${String(count).padStart(4)}  ${file}`);
}
console.log(origins.length === 0 ? "no any starts in the typed code" : `${origins.length} places where an any starts`);
process.exitCode = origins.length === 0 ? 0 : 1;
