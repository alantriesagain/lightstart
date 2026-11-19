/**
 * @file The check `light serve --watch` runs after a source change: light's own convention
 * checker over the project, debounced, printing only what a run added or cleared.
 */
import type { Logger } from "@lightstart/cli";
import { TEXT_EXTENSIONS, formatFinding, loadRules, openProject, runRules, type ReportedFinding } from "@lightstart/light/check";

const DEBOUNCE_MS = 300;

const findingKey = (finding: ReportedFinding): string =>
  `${finding.file}\u0000${String(finding.line)}\u0000${String(finding.col)}\u0000${finding.ruleId}\u0000${finding.severity}\u0000${finding.message}`;

const isCheckedPath = (path: string): boolean => {
  const segments = path.split("/");
  if (segments.some((segment) => segment.startsWith("."))) return false;
  return TEXT_EXTENSIONS.some((extension) => path.endsWith(extension));
};

/** The running checker: one schedule per settled change and one stop at shutdown. */
export type Checker = {
  schedule(path: string): void;
  stop(): void;
};

/**
 * Run light's check over `projectDir` once to learn the baseline, then after each scheduled
 * change, printing only the findings it added and the ones it cleared.
 */
export const startChecker = (projectDir: string, log: Logger): Checker => {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let queued = false;
  let stopped = false;
  let previous: ReportedFinding[] | null = null;
  const reported = new Set<string>();

  const note = (message: string): void => {
    if (reported.has(message)) return;
    reported.add(message);
    log.error(message);
  };

  const run = async (): Promise<void> => {
    if (stopped) return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      await import("@lightstart/light/check/parse/typescript.js");
      const opened = openProject(projectDir);
      const { rules, warnings, failures } = await loadRules(opened.sources);
      if (failures.length) {
        for (const failure of failures) note(`check: ${failure}`);
        return;
      }
      for (const warning of warnings) note(`check: ${warning}`);
      const result = await runRules({ context: opened.context, rules });
      for (const warning of result.configWarnings) note(`check: ${warning}`);
      const findings = result.findings;
      if (previous === null) {
        if (findings.length > 0) log.log(`check: ${String(findings.length)} finding${findings.length === 1 ? "" : "s"}; run light check to list them`);
      } else {
        const before = new Set(previous.map(findingKey));
        const after = new Set(findings.map(findingKey));
        const added = findings.filter((finding) => !before.has(findingKey(finding)));
        const cleared = previous.filter((finding) => !after.has(findingKey(finding)));
        if (added.length > 0) {
          log.log(`check: +${String(added.length)} new`);
          for (const finding of added) log.log(formatFinding(finding));
        }
        if (cleared.length > 0) {
          log.log(`check: −${String(cleared.length)} cleared`);
          for (const finding of cleared) log.log(formatFinding(finding));
        }
      }
      previous = findings;
    } catch (error) {
      note(`check: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
      if (queued && !stopped) {
        queued = false;
        void run();
      }
    }
  };

  const schedule = (path: string): void => {
    if (stopped || !isCheckedPath(path)) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, DEBOUNCE_MS);
  };

  void run();

  return {
    schedule,
    stop() {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
};
