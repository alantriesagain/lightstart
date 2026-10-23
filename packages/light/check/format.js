/** How a finding and a run's summary print, in colour on a terminal. */

const useColor = () => process.stdout.isTTY && !process.env.NO_COLOR;

/**
 * @param {string} code
 * @param {string} text
 */
export const paint = (code, text) => (useColor() ? `\x1b[${code}m${text}\x1b[0m` : text);

/** @param {{ ruleId: string, severity: string, file: string, line: number, col: number, message: string }} finding */
export const formatFinding = (finding) => {
  const sev = finding.severity === "error" ? paint("31", "error") : paint("33", "warn ");
  return `[check] ${finding.file}:${finding.line}:${finding.col}  ${sev}  ${finding.message}  ${paint("90", `(${finding.ruleId})`)}`;
};

/** @param {{ files: number, rules: number, errors: number, warnings: number, durationMs: number }} stats */
export const formatSummary = (stats) => {
  const seconds = (stats.durationMs / 1000).toFixed(1);
  if (stats.errors === 0 && stats.warnings === 0)
    return paint("32", `✓ check passed: ${stats.rules} rules, 0 findings (${stats.files} files, ${seconds}s)`);
  const parts = [];
  if (stats.errors) parts.push(paint("31", `${stats.errors} error${stats.errors === 1 ? "" : "s"}`));
  if (stats.warnings) parts.push(paint("33", `${stats.warnings} warning${stats.warnings === 1 ? "" : "s"}`));
  return `${stats.errors ? paint("31", "✗") : paint("33", "!")} ${parts.join(", ")}: ${stats.rules} rules, ${stats.files} files (${seconds}s)`;
};
