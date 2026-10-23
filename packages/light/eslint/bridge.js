/**
 * @bootstrapp/light/eslint/bridge.js: the convention checker as two eslint
 * rules, so an eslint editor extension shows its findings in the file being
 * edited. `check-errors` reports the findings of severity error, and
 * `check-warnings` those of severity warn, each at its line and column with
 * the checker's rule id after the message. A project is opened once per root
 * and process and its rules run once; a file whose text differs from what
 * the project last read (an unsaved buffer) stands in for the file and the
 * rules run again. A rule that awaits is skipped here; the command line shows
 * it.
 */

import path from "node:path";
import { runRulesSync } from "../check/engine.js";
import { projectRoot } from "../check/project.js";
import { toRel } from "../check/walk.js";

/** @import { Rule } from "eslint" */
/** @import { ProjectModel, ReportedFinding } from "../check/types.ts" */
/** @import { CheckHost, Project } from "./types.ts" */

/**
 * The two bridge rules over a host: `open(root)` answers a project's context
 * and rules, `rootOf(dir)` the root a directory's files belong to (null when
 * none, and the file is left alone).
 * @template {ProjectModel} M
 * @param {CheckHost<M>} open
 * @param {(dir: string) => string | null} [rootOf]
 * @returns {Record<"check-errors" | "check-warnings", Rule.RuleModule>}
 */
export const checkRules = (open, rootOf = projectRoot) => {
  /** @type {Map<string, string | null>} */
  const roots = new Map();
  /** @type {Map<string, Project<M>>} */
  const projects = new Map();

  /** @param {string} dir */
  const rootFor = (dir) => {
    if (!roots.has(dir)) roots.set(dir, rootOf(dir));
    return roots.get(dir) ?? null;
  };

  /**
   * @param {Rule.RuleContext} context
   * @returns {ReportedFinding[]}
   */
  const findingsIn = (context) => {
    const file = context.physicalFilename;
    if (!path.isAbsolute(file)) return [];
    const root = rootFor(path.dirname(file));
    if (!root) return [];
    let project = projects.get(root);
    if (!project) {
      project = { ...open(root), findings: null };
      projects.set(root, project);
    }
    const rel = toRel(root, file);
    const text = context.sourceCode.text;
    const stale = project.context.read(rel) !== text;
    if (stale) project.context.invalidate(rel, text);
    if (stale || !project.findings)
      project.findings = Map.groupBy(runRulesSync({ context: project.context, rules: project.rules }).findings, (finding) => finding.file);
    return project.findings.get(rel) ?? [];
  };

  /**
   * @param {"error" | "warn"} severity
   * @param {string} description
   * @returns {Rule.RuleModule}
   */
  const rule = (severity, description) => ({
    meta: { type: "problem", schema: [], docs: { description } },
    create: (context) => ({
      Program() {
        for (const finding of findingsIn(context))
          if (finding.severity === severity)
            context.report({
              loc: { line: Math.max(finding.line, 1), column: Math.max(finding.col - 1, 0) },
              message: `${finding.message} (${finding.ruleId})`,
            });
      },
    }),
  });

  return {
    "check-errors": rule("error", "the convention checker's errors in this file"),
    "check-warnings": rule("warn", "the convention checker's warnings in this file"),
  };
};
