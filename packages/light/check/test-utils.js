/**
 * The fixture harness for rule tests: an in-memory context from a
 * relative-path to content map, a rule run over it with its gate ignored,
 * and the gate's answer on its own.
 */

import { ruleApplies } from "./applies.js";
import { createContext } from "./context.js";
import { resolveFinding } from "./report.js";

/** @import { CheckRule, Finding, HostOptions, PackageJson, ProjectContext, ProjectModel } from "./types.ts" */

/** @typedef {{ pkgJson?: PackageJson, projectDir?: string, host?: HostOptions }} FixtureOptions */
/** @typedef {{ severity: "error" | "warn", file: string, line: number, col: number, message: string }} FixtureFinding */

export const FIXTURE_PKG = { name: "fixture", bootstrapp: { prefix: "fx", components: { fx: "views/" } } };

/**
 * The map with a `package.json`: its own, the given one, or the fixture's default.
 * @param {Record<string, string>} fileMap
 * @param {PackageJson} [pkgJson]
 */
export const withManifest = (fileMap, pkgJson) => (fileMap["package.json"] ? { ...fileMap } : { ...fileMap, "package.json": JSON.stringify(pkgJson || FIXTURE_PKG) });

/**
 * Build an in-memory context from a relative-path to content map.
 * @param {Record<string, string>} fileMap
 * @param {FixtureOptions} [opts]
 * @returns {ProjectContext}
 */
export const contextFromFiles = (fileMap, { pkgJson, projectDir = "/fixture", host } = {}) => createContext({ projectDir, fileMap: withManifest(fileMap, pkgJson), host });

/**
 * The reason a rule's gate skips a context, or null when it applies.
 * @template {ProjectModel} M
 * @param {CheckRule<M>} rule
 * @param {ProjectContext<M>} ctx
 */
export const skipReason = (rule, ctx) => ruleApplies(rule, ctx)?.reason ?? null;

/**
 * Run one rule's check over a context, ignoring its gate.
 * @template {ProjectModel} M
 * @param {CheckRule<M>} rule
 * @param {ProjectContext<M>} ctx
 * @returns {Promise<FixtureFinding[]>}
 */
export const runRule = async (rule, ctx) => {
  /** @type {FixtureFinding[]} */
  const findings = [];
  const report = (/** @type {Finding} */ finding) => findings.push({ severity: rule.severity, ...resolveFinding(finding, ctx.lineAt) });
  await rule.check({ ...ctx, report });
  return findings;
};

/**
 * The reason a rule does not apply to an in-memory fixture, or null when it does.
 * @param {CheckRule} rule
 * @param {Record<string, string>} fileMap
 * @param {FixtureOptions} [opts]
 */
export const appliesOn = (rule, fileMap, opts = {}) => skipReason(rule, contextFromFiles(fileMap, opts));

/**
 * Run one rule's check against an in-memory file map, ignoring its gate
 * (`appliesOn` tests the gate). Returns the findings.
 * @param {CheckRule} rule
 * @param {Record<string, string>} fileMap
 * @param {FixtureOptions} [opts]
 */
export const runRuleOn = (rule, fileMap, opts = {}) => runRule(rule, contextFromFiles(fileMap, opts));
