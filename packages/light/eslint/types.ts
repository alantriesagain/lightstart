/**
 * @bootstrapp/light/eslint/types.ts: the eslint bridge's contract. A host
 * opens a project for a root; the bridge holds what it opened and the last
 * run's findings.
 */

import type { ProjectContext, ProjectModel, ReportedFinding, RuleEntry } from "../check/types.ts";

/** What a host opens for a project root: the context its rules read and the rules to run. */
export type CheckHost<M extends ProjectModel = ProjectModel> = (root: string) => { context: ProjectContext<M>; rules: RuleEntry<M>[] };

/** A project the bridge holds: what the host opened and the last run's findings by file, null before the first run. */
export interface Project<M extends ProjectModel = ProjectModel> {
  context: ProjectContext<M>;
  rules: RuleEntry<M>[];
  findings: Map<string, ReportedFinding[]> | null;
}
