/**
 * @file @lightstart/mobile: a light app as an Android app. A project opts in
 * with `src/mobile.ts` or `src/mobile.js` default-exporting `defineMobile`, and
 * the `light mobile:*` commands scaffold, sync and build the shell. The page
 * API lives at `@lightstart/mobile/page`.
 */

export type {
  MobileApi,
  MobileReady,
  MobileShareFile,
  MobileShareOptions,
  MobileShareResult,
  MobileShared,
  MobileSharedFile,
  MobileReminder,
  MobileRemindersApi,
  MobileCaptureOptions,
  MobileCaptureResult,
} from "./page.ts";

/** The orientation the shell holds: `"any"` follows the device. */
export type MobileOrientation = "portrait" | "landscape" | "any";

/** The store version: the name shown and the code Android compares. */
export interface MobileVersion {
  name: string;
  code: number;
}

/** What the shell accepts from another app's share sheet. */
export interface MobileShareTarget {
  path: string;
  types?: string[];
}

/** Which discovered Android add-ons to leave out of the shell. */
export interface MobileAddonsConfig {
  disable?: string[];
}

/** What `src/mobile.ts` (or `.js`) declares. */
export interface MobileConfig {
  appId: string;
  name?: string;
  version?: Partial<MobileVersion>;
  orientation?: MobileOrientation;
  minSdk?: number;
  shareTarget?: MobileShareTarget | MobileShareTarget[];
  cameraApp?: string;
  addons?: MobileAddonsConfig;
}

/** The defaults the commands fill in for a config. */
export interface ResolvedMobile {
  appId: string;
  name: string;
  version: MobileVersion;
  orientation: MobileOrientation;
  minSdk: number;
  shareTarget?: MobileShareTarget[];
  cameraApp?: string;
  addons?: MobileAddonsConfig;
  base: string;
}

const ORIENTATIONS: readonly MobileOrientation[] = ["portrait", "landscape", "any"];

/** Whether a value is one of the orientations the shell understands. */
export const isOrientation = (value: unknown): value is MobileOrientation => typeof value === "string" && (ORIENTATIONS as readonly string[]).includes(value);

/** Keep the config's literal type and refuse one without an app id. */
export const defineMobile = (config: MobileConfig): MobileConfig => {
  if (typeof config.appId !== "string" || config.appId.trim() === "") throw new Error("defineMobile needs an appId, such as \"com.example.app\"");
  return config;
};
