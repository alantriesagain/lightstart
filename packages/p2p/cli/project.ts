/**
 * @file Whether the project being served declares `@lightstart/p2p`. The
 * relay is hosted only for a project that does, in the serve extension and
 * the route the dev server offers upgrades to.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SECTIONS = ["dependencies", "devDependencies", "peerDependencies"];

/** Whether the project's `package.json` names `@lightstart/p2p` in a dependency list. */
export const projectHasP2P = (projectDir: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const pkg = parsed as Record<string, unknown>;
  for (const section of SECTIONS) {
    const deps = pkg[section];
    if (deps === null || typeof deps !== "object" || Array.isArray(deps)) continue;
    if (Object.prototype.hasOwnProperty.call(deps, "@lightstart/p2p")) return true;
  }
  return false;
};
