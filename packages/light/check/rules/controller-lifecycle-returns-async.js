import ts from "typescript";
import { defineRule } from "../define.js";
import { nameOf } from "../parse/ast.js";

const HOOKS = new Set(["connected", "disconnected"]);

/** @param {ts.ObjectLiteralElementLike} member */
const functionOf = (member) => {
  if (ts.isMethodDeclaration(member)) return member;
  if (ts.isPropertyAssignment(member) && (ts.isFunctionExpression(member.initializer) || ts.isArrowFunction(member.initializer)))
    return member.initializer;
  return null;
};

/** @param {ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction} fn */
const isAsync = (fn) => Boolean(fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));

/** @param {ts.Node} node */
const isFunctionLike = (node) =>
  ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);

/**
 * Whether a call is handed straight to `trackWork(...)`, which counts it with
 * the host without holding `$ready` for it.
 * @param {ts.Node} node
 */
const isHandedToTrackWork = (node) => {
  const call = node.parent;
  return !!call && ts.isCallExpression(call) && call.arguments.includes(/** @type {ts.Expression} */ (node))
    && ts.isIdentifier(call.expression) && call.expression.text === "trackWork";
};

/**
 * @param {ts.Node} node
 * @param {ts.Node} stop
 */
const isTracked = (node, stop) => {
  if (isHandedToTrackWork(node)) return true;
  for (let cursor = node.parent; cursor && cursor !== stop; cursor = cursor.parent)
    if (ts.isAwaitExpression(cursor) || ts.isReturnStatement(cursor)) return true;
  return false;
};

/**
 * @param {ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction} fn
 * @param {Set<string>} asyncMethods
 */
const droppedCalls = (fn, asyncMethods) => {
  /** @type {string[]} */
  const dropped = [];
  const walk = (/** @type {ts.Node} */ node) => {
    if (node !== fn && isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const { expression, name } = node.expression;
      const ownAsync = expression.kind === ts.SyntaxKind.ThisKeyword && asyncMethods.has(name.text);
      const then = name.text === "then";
      if ((ownAsync || then) && !isTracked(node, fn))
        dropped.push(ownAsync ? `this.${name.text}()` : ".then()");
    }
    ts.forEachChild(node, walk);
  };
  if (fn.body) walk(fn.body);
  return dropped;
};

export default defineRule({
  severity: "error",
  description: "a controller's connected()/disconnected() must return or await the async work it starts",
  why: "$ready settles with what connected() returns, and the host counts it as controller:<name>; a dropped promise makes the controller report loaded before its data exists, a caller awaiting $ready goes on too early, and a prerender captures the page before the load lands",
  check(ctx) {
    for (const controller of ctx.controllers()) {
      const { literal, sf } = controller;
      /** @type {Set<string>} */
      const asyncMethods = new Set();
      for (const member of literal.properties) {
        const fn = functionOf(member);
        const key = nameOf(member.name);
        if (fn && key && isAsync(fn)) asyncMethods.add(key);
      }
      for (const member of literal.properties) {
        const key = nameOf(member.name);
        if (!key || !HOOKS.has(key)) continue;
        const fn = functionOf(member);
        if (!fn || !fn.body) continue;
        const dropped = droppedCalls(fn, asyncMethods);
        if (!dropped.length) continue;
        ctx.report({
          file: controller.file,
          offset: member.getStart(sf),
          message: `${key}() starts ${dropped[0]} without returning or awaiting it; return or await it so $ready and the host count the load, or hand it to trackWork(promise, label) when $ready should not wait for it`,
        });
      }
    }
  },
});
