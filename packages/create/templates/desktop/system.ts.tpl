/**
 * @file What the backend reads from the machine. Kept apart from `backend.ts` so the test can run
 * it under node, where `DesktopApp` (and the window it opens) is never started.
 */
import type { Machine } from "./contract.ts";

/** The platform and the home directory of the machine the app runs on. */
export const machine = (): Machine => {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
  return { platform: process.platform, home };
};
