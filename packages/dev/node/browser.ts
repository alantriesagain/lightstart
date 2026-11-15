/**
 * @file The command `light serve --open` runs to open the page in the system's browser, per
 * platform; node-only because the caller spawns it.
 */

/** The shell command that opens `url` in the platform's browser, or null when the platform has none. */
export const browserCommand = (platform: NodeJS.Platform, url: string): string | null => {
  if (platform === "darwin") return `open "${url}"`;
  if (platform === "win32") return `start "" "${url}"`;
  if (platform === "linux") return `xdg-open "${url}"`;
  return null;
};
