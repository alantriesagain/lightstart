/**
 * @file Format a byte count as a human-readable string.
 */

/** Format a byte count as `"1.5 MB"`; nothing is `"0 B"`. */
export const formatBytes = (bytes: number | undefined | null): string => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};
