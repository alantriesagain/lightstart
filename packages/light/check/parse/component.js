/** The shape of every component definition a module holds, read from its definition sites. */

import * as ts from "typescript";
import { hasNonNullDefault, mixinBindings, nameOf, sourceFile } from "./ast.js";
import { definitionSites } from "./sites.js";

/** @import { ParsedComponent, PropertyInfo } from "../types.ts" */

/**
 * @param {ts.ObjectLiteralExpression} props
 * @param {ts.SourceFile} sf
 * @returns {PropertyInfo[]}
 */
const readProps = (props, sf) => {
  /** @type {PropertyInfo[]} */
  const out = [];
  for (const p of props.properties) {
    const name = nameOf(p.name);
    if (name) out.push({ name, offset: p.getStart(sf), hasNonNullDefault: hasNonNullDefault(p) });
  }
  return out;
};

/**
 * @param {string} source
 * @param {string} filename
 * @returns {ParsedComponent[]} one per definition site, in source order; empty when the module defines nothing
 */
export const parseComponentSources = (source, filename) => {
  const sf = sourceFile(source, filename);
  return definitionSites(sf).map((site) => {
    const { literal } = site;
    let tag = site.tag;
    /** @type {string | null} */
    let extendsTag = null;
    let styleTrue = false;
    let styleKnown = site.direct;
    /** @type {string[]} */
    const topLevelKeys = [];
    /** @type {PropertyInfo[]} */
    let propertyNames = [];
    /** @type {number | null} */
    let propsOffset = null;
    /** @type {Record<string, number>} */
    const keyOffsets = {};
    for (const m of literal?.properties ?? []) {
      const key = nameOf(m.name);
      if (!key) continue;
      topLevelKeys.push(key);
      keyOffsets[key] = m.getStart(sf);
      if (!ts.isPropertyAssignment(m)) continue;
      if (key === "tag" && ts.isStringLiteral(m.initializer)) tag ??= m.initializer.text;
      if (key === "extends" && ts.isStringLiteralLike(m.initializer)) extendsTag = m.initializer.text;
      if (key === "style") {
        styleTrue = m.initializer.kind === ts.SyntaxKind.TrueKeyword;
        styleKnown = styleTrue || m.initializer.kind === ts.SyntaxKind.FalseKeyword;
      }
      if (key === "props" && !site.props && ts.isObjectLiteralExpression(m.initializer)) {
        propsOffset = m.initializer.getStart(sf);
        propertyNames = readProps(m.initializer, sf);
      }
    }
    if (site.props) {
      propsOffset = site.props.getStart(sf);
      keyOffsets.props = propsOffset;
      propertyNames = readProps(site.props, sf);
    }
    if (site.render) {
      topLevelKeys.push("render");
      keyOffsets.render = site.render.getStart(sf);
    }
    return {
      tag,
      extends: extendsTag,
      styleTrue,
      styleKnown,
      mixins: literal ? mixinBindings(sf, literal) : [],
      topLevelKeys,
      keyOffsets,
      propertyNames,
      propsOffset,
      literal,
      sf,
      offset: site.offset,
      defined: site.defined,
    };
  });
};

/**
 * The definition a tag names among a module's: the one declaring it, else the
 * module's only one.
 * @param {ParsedComponent[]} parsed
 * @param {string | null} tag
 * @returns {ParsedComponent | null}
 */
export const definitionOf = (parsed, tag) => parsed.find((p) => p.tag === tag) ?? (parsed.length === 1 ? parsed[0] : null);
