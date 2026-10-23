import * as ts from "typescript";
import { defineRule } from "../define.js";
import { filesIn, parse, PERF_GATE, perfConfig, reportSites, siteAt } from "../perf.js";

/** @import { Node, SourceFile, TypeNode } from "typescript" */
/** @import { ProjectModel } from "../types.ts" */
/** @import { Site } from "../perf.js" */

const RULE = "light/perf-record-union";

/**
 * The object type a union member stands for: an inline type literal, or a
 * type alias declared in the same file whose type is one.
 * @param {SourceFile} sf
 * @param {TypeNode} member
 * @returns {import("typescript").TypeLiteralNode | null}
 */
const literalOf = (sf, member) => {
  if (ts.isTypeLiteralNode(member)) return member;
  if (ts.isParenthesizedTypeNode(member)) return literalOf(sf, member.type);
  if (ts.isTypeReferenceNode(member) && ts.isIdentifier(member.typeName) && !member.typeArguments) {
    const name = member.typeName.text;
    for (const statement of sf.statements)
      if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name && ts.isTypeLiteralNode(statement.type)) return statement.type;
  }
  return null;
};

/**
 * The string literal a type literal gives a property, or null.
 * @param {import("typescript").TypeLiteralNode} literal
 * @param {string} name
 */
const tagOf = (literal, name) => {
  for (const member of literal.members)
    if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name) && member.name.text === name && member.type && ts.isLiteralTypeNode(member.type) && ts.isStringLiteral(member.type.literal))
      return member.type.literal.text;
  return null;
};

/**
 * Every type alias that is a union of two or more object types told apart by a string-literal property.
 * @param {ProjectModel} ctx
 * @returns {Site[]}
 */
export const find = (ctx) => {
  const perf = perfConfig(ctx);
  if (!perf) return [];
  /** @type {Site[]} */
  const sites = [];
  for (const file of filesIn(ctx, perf.native).filter((name) => name.endsWith(".ts"))) {
    const sf = parse(ctx, file);
    for (const statement of sf.statements) {
      if (!ts.isTypeAliasDeclaration(statement) || !ts.isUnionTypeNode(statement.type)) continue;
      const literals = statement.type.types.map((member) => literalOf(sf, member)).filter((literal) => literal !== null);
      if (literals.length < 2) continue;
      const names = new Set(literals.flatMap((literal) => literal.members.flatMap((member) => (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name) ? [member.name.text] : []))));
      for (const name of names) {
        const tags = literals.map((literal) => tagOf(literal, name)).filter((tag) => tag !== null);
        if (tags.length >= 2 && new Set(tags).size === tags.length) {
          sites.push(
            siteAt(
              file,
              sf,
              /** @type {Node} */ (statement.name),
              `${statement.name.text} is ${tags.length} object types told apart by \`${name}\`: natively each check compares strings, and V8 sees one shape per member at every read. Use classes and instanceof`,
            ),
          );
          break;
        }
      }
    }
  }
  return sites;
};

export default defineRule({
  severity: "warn",
  description: "no unions of records told apart by a string tag in code that compiles natively",
  why: "measured: a union of records with a string `kind` was slower than classes behind an interface under both engines; natively `x.kind === \"a\"` is a string comparison with a retain and release",
  appliesTo: PERF_GATE,
  check(ctx) {
    reportSites(ctx, RULE, find(ctx));
  },
});
