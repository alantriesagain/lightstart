/**
 * A byte count as people read it: `1536` is `"1.5 KB"`.
 * @param {number | undefined | null} bytes
 * @returns {string}
 */
export const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};
