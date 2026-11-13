/**
 * @file The `<outDir>/builds/<id>` layout: build ids newest first, the `current` link, and retention.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";

/** The build ids under an output folder, newest first. */
export const getBuilds = async (outDir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(join(outDir, "builds"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && entry.name !== "current").map((entry) => entry.name).sort().reverse();
  } catch {
    return [];
  }
};

/** Remove every build after the newest `keep`, oldest first. */
export const cleanupOldBuilds = async (outDir: string, keep: number): Promise<void> => {
  for (const id of (await getBuilds(outDir)).slice(keep)) await fs.rm(join(outDir, "builds", id), { recursive: true, force: true });
};

/** Point `<outDir>/current` at the build with this id. */
export const updateCurrent = async (outDir: string, id: string): Promise<void> => {
  const current = join(outDir, "current");
  await fs.rm(current, { recursive: true, force: true });
  await fs.symlink(join("builds", id), current, "dir");
};
