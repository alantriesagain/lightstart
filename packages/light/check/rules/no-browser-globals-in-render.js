import { defineRule } from "../define.js";
import { defaultImportBinding, importBinding, nameOf, resolveLocal, sourceFile, unwrapParens } from "../parse/ast.js";
import { parseComponentSources } from "../parse/component.js";
import { elements } from "../parse/markup.js";
import ts from "../parse/typescript.js";

/** @import { Expression, Node, SourceFile } from "typescript" */

const GLOBALS = new Set([
  "window", "document", "location", "history", "navigator", "localStorage", "sessionStorage",
  "matchMedia", "getComputedStyle", "requestAnimationFrame", "innerWidth", "innerHeight", "customElements",
]);
const DIMENSION_PROPS = new Set(["offsetWidth", "offsetHeight", "clientWidth", "clientHeight", "scrollTop"]);
const ENV = new Set(["innerWidth", "innerHeight", "matchMedia"]);
const NAVIGATION = new Set(["location", "history"]);
const STORAGE = new Set(["localStorage", "sessionStorage"]);

const EQUIVALENTS = {
  env: "use `env` from `@lightstart/light/env` (width, height, breakpoint, isMobile, prefersDark)",
  navigation: "use `navigation.path()` / `navigation.go()` from `@lightstart/light/navigation`",
  storage: "use a storage adapter (`@lightstart/light/controller/storage`) through a controller's `sync`",
  i18n: "use `translation.language()` from `@lightstart/light/i18n`",
  move: "move it to `connected()` or an event handler",
};

const isLightSpec = (/** @type {string} */ spec) => spec === "@lightstart/light" || spec.endsWith("/view/index.js");
const isUndefinedLiteral = (/** @type {Node} */ node) =>
  (ts.isStringLiteral(node) && node.text === "undefined") || (ts.isIdentifier(node) && node.text === "undefined");

/**
 * @param {Node} node
 * @returns {boolean}
 */
const isTypeofOperand = (node) => {
  let parent = node.parent;
  while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent;
  return !!parent && ts.isTypeOfExpression(parent);
};

/**
 * @param {Node} node
 * @returns {boolean}
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
 * @param {Node} operand
 * @returns {string | null}
 */
const globalNameOf = (operand) => {
  const node = unwrapParens(/** @type {Expression} */ (operand));
  if (!node) return null;
  if (ts.isIdentifier(node)) return GLOBALS.has(node.text) ? node.text : null;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "globalThis" && GLOBALS.has(node.name.text)) return node.name.text;
  return null;
};

/**
 * The names a `typeof <global>` test guards, and which branch is the safe one.
 * @param {Expression} expression
 * @returns {{ names: string[], present: boolean } | null}
 */
const guardOf = (expression) => {
  const expr = unwrapParens(expression);
  if (!expr || !ts.isBinaryExpression(expr)) return null;
  const kind = expr.operatorToken.kind;
  const equal = kind === ts.SyntaxKind.EqualsEqualsToken || kind === ts.SyntaxKind.EqualsEqualsEqualsToken;
  const unequal = kind === ts.SyntaxKind.ExclamationEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  if (!equal && !unequal) return null;
  const left = unwrapParens(expr.left);
  const right = unwrapParens(expr.right);
  if (!left || !right) return null;
  const typeofSide = ts.isTypeOfExpression(left) ? left : ts.isTypeOfExpression(right) ? right : null;
  const other = typeofSide === left ? right : left;
  if (!typeofSide || !isUndefinedLiteral(other)) return null;
  const name = globalNameOf(typeofSide.expression);
  if (!name) return null;
  return { names: [name], present: unequal };
};

/**
 * @param {string} name
 * @param {string | null} hint
 * @returns {string}
 */
const equivalentFor = (name, hint) => {
  const subject = hint && GLOBALS.has(hint) ? hint : name;
  if (ENV.has(subject) || ENV.has(hint ?? "")) return EQUIVALENTS.env;
  if (NAVIGATION.has(subject) || NAVIGATION.has(hint ?? "")) return EQUIVALENTS.navigation;
  if (STORAGE.has(subject) || STORAGE.has(hint ?? "")) return EQUIVALENTS.storage;
  if (subject === "navigator" || hint === "navigator") return EQUIVALENTS.i18n;
  return EQUIVALENTS.move;
};

/**
 * @param {Node} node
 * @param {SourceFile} sf
 * @returns {{ name: string, text: string, offset: number, message: string } | null}
 */
const browserRead = (node, sf) => {
  if (ts.isTypeOfExpression(node) || isTypeofOperand(node)) return null;
  if (ts.isIdentifier(node)) {
    const name = node.text;
    if (!GLOBALS.has(name) || isName(node)) return null;
    const parent = node.parent;
    const hint = parent && ts.isPropertyAccessExpression(parent) && parent.expression === node ? parent.name.text : null;
    const text = hint ? `${name}.${hint}` : name;
    return {
      name,
      text,
      offset: node.getStart(sf),
      message: `\`${text}\` is read while this view renders; ${equivalentFor(name, hint)}; it does not exist on a server or terminal`,
    };
  }
  if (ts.isPropertyAccessExpression(node)) {
    const property = node.name.text;
    if (DIMENSION_PROPS.has(property) || property === "getBoundingClientRect")
      return {
        name: property,
        text: property,
        offset: node.getStart(sf),
        message: `\`${property}\` is read while this view renders; ${EQUIVALENTS.move}; it does not exist on a server or terminal`,
      };
    if (ts.isIdentifier(node.expression) && node.expression.text === "globalThis" && GLOBALS.has(property)) {
      const parent = node.parent;
      const hint = parent && ts.isPropertyAccessExpression(parent) && parent.expression === node ? parent.name.text : null;
      const text = hint ? `globalThis.${property}.${hint}` : `globalThis.${property}`;
      return {
        name: property,
        text,
        offset: node.getStart(sf),
        message: `\`${text}\` is read while this view renders; ${equivalentFor(property, hint)}; it does not exist on a server or terminal`,
      };
    }
  }
  return null;
};

/**
 * @param {SourceFile} sf
 * @returns {Node[]}
 */
const classRenderNodes = (sf) => {
  /** @type {Node[]} */
  const out = [];
  const lightDefault = defaultImportBinding(sf, isLightSpec);
  /** @param {Expression} expression @returns {boolean} */
  const isViewBase = (expression) => {
    const base = unwrapParens(expression);
    if (!base) return false;
    if (ts.isIdentifier(base)) {
      if (base.text === "View" || base.text === "ViewCore" || (lightDefault && base.text === lightDefault)) return true;
      const binding = importBinding(sf, base.text);
      return !!binding && isLightSpec(binding.spec) && (binding.exported === "View" || binding.exported === "ViewCore");
    }
    if (ts.isCallExpression(base)) {
      const callee = base.expression;
      return ts.isPropertyAccessExpression(callee) && callee.name.text === "props" && isViewBase(callee.expression);
    }
    return ts.isPropertyAccessExpression(base) && (base.name.text === "View" || base.name.text === "ViewCore");
  };
  /** @param {Node} node */
  const visit = (node) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const heritage = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
      if (heritage?.types.some((type) => isViewBase(type.expression)))
        for (const member of node.members) {
          if (!member.name || nameOf(member.name) !== "render") continue;
          if (ts.isMethodDeclaration(member)) out.push(member);
          else if (ts.isPropertyDeclaration(member) && member.initializer) out.push(member.initializer);
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
};

/**
 * @param {Node} literal
 * @returns {Node | null}
 */
const renderNodeOf = (literal) => {
  if (!ts.isObjectLiteralExpression(literal)) return null;
  for (const member of literal.properties) {
    if (nameOf(member.name) !== "render") continue;
    if (ts.isMethodDeclaration(member)) return member;
    if (ts.isPropertyAssignment(member)) return resolveLocal(member.initializer);
    if (ts.isShorthandPropertyAssignment(member)) return resolveLocal(member.name);
  }
  return null;
};

/**
 * @param {Node} node
 * @returns {Expression | null}
 */
const propsLiteral = (node) => {
  if (!ts.isObjectLiteralExpression(node)) return null;
  for (const member of node.properties)
    if (nameOf(member.name) === "props" && ts.isPropertyAssignment(member)) {
      const value = unwrapParens(member.initializer);
      return value && ts.isObjectLiteralExpression(value) ? value : null;
    }
  return null;
};

/**
 * Every default value expression a props object declares.
 * @param {Node} props
 * @returns {Node[]}
 */
const defaultNodes = (props) => {
  if (!ts.isObjectLiteralExpression(props)) return [];
  /** @type {Node[]} */
  const out = [];
  for (const member of props.properties) {
    if (!ts.isPropertyAssignment(member)) continue;
    const value = unwrapParens(member.initializer);
    if (!value) continue;
    if (ts.isCallExpression(value) && value.arguments.length) {
      const arg = unwrapParens(value.arguments[0]);
      if (!arg) continue;
      if (ts.isObjectLiteralExpression(arg)) {
        for (const option of arg.properties)
          if (nameOf(option.name) === "defaultValue" && ts.isPropertyAssignment(option)) out.push(option.initializer);
      } else out.push(arg);
    } else out.push(value);
  }
  return out;
};

export default defineRule({
  severity: "warn",
  description: "a view may not read a browser global while it renders; a server or terminal host has no window",
  why: "light renders the same view on a server and in the terminal, where window, document, storage, layout measurements and matchMedia do not exist; a read during render either throws on the server or makes the markup depend on a browser the page does not have. Reads in an event handler or in connected() are safe because those run only in a browser",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!/\.(js|ts)$/.test(file) || /\.test\.(js|ts)$/.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      /** @type {SourceFile} */
      let sf;
      let views;
      try {
        views = parseComponentSources(source, file);
        sf = views[0]?.sf ?? sourceFile(source, file);
      } catch {
        continue;
      }
      const classNodes = classRenderNodes(sf);
      const viewDefinitions = views.filter((view) => view.defined || !!view.tag || !!view.render || (view.literal && renderNodeOf(view.literal)));
      const renderNodes = [...viewDefinitions.map((view) => view.render ?? (view.literal ? renderNodeOf(view.literal) : null)), ...classNodes]
        .filter((node) => !!node);
      if (!renderNodes.length && !viewDefinitions.length) continue;

      const seen = new Set();
      /** @param {Node} node @param {string} message */
      const report = (node, message) => {
        const offset = node.getStart(sf);
        if (seen.has(offset)) return;
        seen.add(offset);
        ctx.report({ file, offset, message });
      };
      /** @type {Array<[number, number]>} */
      const handlers = [];
      for (const template of ctx.markup(file))
        for (const element of elements(template))
          for (const attr of element.attrs)
            if (attr.kind === "event" || /^on[A-Z]/.test(attr.name))
              for (const expression of attr.expressions) handlers.push([expression.offset, expression.end]);

      /** @param {Node} node @param {Set<string>} guarded @param {boolean} importTime */
      const walk = (node, guarded, importTime) => {
        if (importTime && ts.isFunctionLike(node)) return;
        const start = node.getStart(sf);
        if (handlers.some(([from, to]) => start >= from && start < to)) return;
        const read = browserRead(node, sf);
        if (read) {
          if (!guarded.has(read.name)) report(node, read.message);
          return;
        }
        if (ts.isTypeOfExpression(node)) return;
        if (ts.isIfStatement(node)) {
          walk(node.expression, guarded, importTime);
          const guard = guardOf(node.expression);
          /** @type {Set<string>} */
          const thenGuarded = new Set(guarded);
          /** @type {Set<string>} */
          const elseGuarded = new Set(guarded);
          if (guard && guard.present) for (const name of guard.names) thenGuarded.add(name);
          if (guard && !guard.present) for (const name of guard.names) elseGuarded.add(name);
          walk(node.thenStatement, thenGuarded, importTime);
          if (node.elseStatement) walk(node.elseStatement, elseGuarded, importTime);
          return;
        }
        if (ts.isConditionalExpression(node)) {
          walk(node.condition, guarded, importTime);
          const guard = guardOf(node.condition);
          /** @type {Set<string>} */
          const whenTrue = new Set(guarded);
          /** @type {Set<string>} */
          const whenFalse = new Set(guarded);
          if (guard && guard.present) for (const name of guard.names) whenTrue.add(name);
          if (guard && !guard.present) for (const name of guard.names) whenFalse.add(name);
          walk(node.whenTrue, whenTrue, importTime);
          walk(node.whenFalse, whenFalse, importTime);
          return;
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          walk(node.left, guarded, importTime);
          const guard = guardOf(node.left);
          /** @type {Set<string>} */
          const rightGuarded = new Set(guarded);
          if (guard && guard.present) for (const name of guard.names) rightGuarded.add(name);
          walk(node.right, rightGuarded, importTime);
          return;
        }
        ts.forEachChild(node, (child) => walk(child, guarded, importTime));
      };

      for (const node of renderNodes) walk(node, new Set(), false);
      for (const view of viewDefinitions)
        for (const props of [view.props, view.literal ? propsLiteral(view.literal) : null].filter((node) => !!node))
          for (const node of defaultNodes(props)) walk(node, new Set(), false);
      for (const statement of sf.statements) walk(statement, new Set(), true);
    }
  },
});
