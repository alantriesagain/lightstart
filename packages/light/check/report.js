/** A finding as a rule reports it, with its line and column resolved. */

/** @import { Finding } from "./types.ts" */

/**
 * @param {Finding} finding
 * @param {(rel: string, offset: number) => { line: number, col: number }} lineAt
 * @returns {{ file: string, line: number, col: number, message: string }}
 */
export const resolveFinding = (finding, lineAt) => {
  const { file, message } = finding;
  let { line, col } = finding;
  if (line == null && finding.offset != null) ({ line, col } = lineAt(file, finding.offset));
  return { file, line: line ?? 0, col: col ?? 0, message };
};
