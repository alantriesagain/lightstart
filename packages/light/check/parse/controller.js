/**
 * The shape of every `defineController({...})` call a module holds: its
 * default export, an exported or local const, or a call anywhere else.
 */

import * as ts from "typescript";
import { hasNonNullDefault, mixinBindings, nameOf, sourceFile, unwrapParens, unwrapToLiteral } from "./ast.js";

/** @import { ControllerProperty, MemberInfo, ParsedController, SyncEntryInfo } from "../types.ts" */

/**
 * One entry of a definition's `sync` block: the short form `prop: target` or
 * the long form `prop: { to, key?, ... }`.
 * @param {ts.PropertyAssignment} entry
 * @param {string} prop
 * @param {ts.SourceFile} sf
 * @returns {SyncEntryInfo}
 */
const syncEntryOf = (entry, prop, sf) => {
  let to = unwrapParens(entry.initializer) ?? entry.initializer;
  /** @type {string | null} */
  let key = null;
  if (ts.isObjectLiteralExpression(to)) {
    const options = to.properties;
    const optionOf = (/** @type {string} */ option) => options.find((p) => ts.isPropertyAssignment(p) && nameOf(p.name) === option);
    const toOption = optionOf("to");
    if (toOption && ts.isPropertyAssignment(toOption)) {
      const keyOption = optionOf("key");
      if (keyOption && ts.isPropertyAssignment(keyOption) && ts.isStringLiteral(keyOption.initializer)) key = keyOption.initializer.text;
      to = unwrapParens(toOption.initializer) ?? toOption.initializer;
    }
  }
  return {
    prop,
    offset: entry.getStart(sf),
    target: ts.isStringLiteral(to) ? to.text : null,
    targetOffset: to.getStart(sf),
    targetText: to.getText(sf),
    key,
  };
};

/**
 * @param {ts.ObjectLiteralElementLike} m
 * @returns {MemberInfo["kind"]}
 */
const memberKind = (m) => {
  if (ts.isMethodDeclaration(m) || (ts.isPropertyAssignment(m) && (ts.isFunctionExpression(m.initializer) || ts.isArrowFunction(m.initializer)))) return "method";
  return ts.isPropertyAssignment(m) ? "value" : "shorthand";
};

/**
 * @param {ts.ObjectLiteralExpression} literal
 * @param {number} offset
 * @param {ts.SourceFile} sf
 * @returns {ParsedController}
 */
const readDefinition = (literal, offset, sf) => {
  /** @type {string | null} */
  let name = null;
  /** @type {string[]} */
  const topLevelKeys = [];
  /** @type {SyncEntryInfo[]} */
  const syncEntries = [];
  /** @type {Record<string, number>} */
  const keyOffsets = {};
  /** @type {ControllerProperty[]} */
  const propertyNames = [];
  /** @type {MemberInfo[]} */
  const memberNames = [];
  for (const m of literal.properties) {
    const key = nameOf(m.name);
    if (!key) continue;
    topLevelKeys.push(key);
    keyOffsets[key] = m.getStart(sf);
    if (key === "name") {
      if (ts.isPropertyAssignment(m) && ts.isStringLiteral(m.initializer)) name = m.initializer.text;
      continue;
    }
    if (key === "sync") {
      if (ts.isPropertyAssignment(m) && ts.isObjectLiteralExpression(m.initializer))
        for (const entry of m.initializer.properties) {
          const prop = nameOf(entry.name);
          if (prop && ts.isPropertyAssignment(entry)) syncEntries.push(syncEntryOf(entry, prop, sf));
        }
      continue;
    }
    if (key === "mixins") continue;
    if (key === "props") {
      if (ts.isPropertyAssignment(m) && ts.isObjectLiteralExpression(m.initializer))
        for (const p of m.initializer.properties) {
          const pk = nameOf(p.name);
          if (pk) propertyNames.push({ name: pk, offset: p.getStart(sf), hasNonNullDefault: hasNonNullDefault(p), sync: null });
        }
      continue;
    }
    memberNames.push({ name: key, offset: m.getStart(sf), kind: memberKind(m) });
  }
  for (const entry of syncEntries) {
    const declared = propertyNames.find((p) => p.name === entry.prop);
    if (declared && entry.target) declared.sync = entry.target;
  }
  return { name, mixins: mixinBindings(sf, literal), topLevelKeys, keyOffsets, propertyNames, memberNames, syncEntries, literal, sf, offset };
};

/**
 * @param {string} source
 * @param {string} filename
 * @returns {ParsedController[]} one per `defineController` call whose definition is a literal, in source order
 */
export const parseControllerSources = (source, filename) => {
  const sf = sourceFile(source, filename);
  /** @type {ParsedController[]} */
  const out = [];
  const visit = (/** @type {ts.Node} */ node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineController" && node.arguments.length) {
      const literal = unwrapToLiteral(node.arguments[0]);
      if (literal) out.push(readDefinition(literal, node.getStart(sf), sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
};
