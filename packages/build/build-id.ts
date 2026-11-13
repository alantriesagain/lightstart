/**
 * @file A build id from a moment: `YYYYMMDD-HHMMSS`, sortable and readable in a path.
 */

/** Format a moment as a build id (`YYYYMMDD-HHMMSS`). */
export const generateBuildId = (now: Date = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};
