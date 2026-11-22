/**
 * @file The Android template and the files the config fills: copy the tree for
 * `mobile:init`, and rewrite only the config-derived files for `mobile:sync`,
 * so a project's own edits survive.
 */

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedMobile } from "../index.ts";

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "android");

const BINARY = /\.(jar|png|jpg|jpeg|webp|zip)$/;

const CONFIG_FILES = [
  "settings.gradle",
  "app/build.gradle",
  "app/src/main/AndroidManifest.xml",
  "app/src/main/res/values/strings.xml",
];

/** The `mobile/android` folder of a project. */
export const androidDir = (project: string): string => join(project, "mobile", "android");

/** Where the built page lives inside the shell. */
export const assetsDir = (project: string): string => join(androidDir(project), "app", "src", "main", "assets", "www");

/** The Android SDK named by the environment, or null. */
export const sdkDirOf = (env: NodeJS.ProcessEnv): string | null => {
  for (const key of ["ANDROID_HOME", "ANDROID_SDK_ROOT"]) {
    const dir = env[key];
    if (dir !== undefined && (existsSync(join(dir, "platform-tools")) || existsSync(join(dir, "cmdline-tools")))) return dir;
  }
  return null;
};

const versions = (dir: string, prefix: string): number[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => Number(entry.slice(prefix.length).split(".")[0]))
    .filter((value) => Number.isInteger(value) && value > 0);
};

/** The newest platform installed under the SDK, else its newest build tools, else 36. */
export const targetSdkOf = (env: NodeJS.ProcessEnv): number => {
  const sdk = sdkDirOf(env);
  if (sdk === null) return 36;
  const platforms = versions(join(sdk, "platforms"), "android-");
  if (platforms.length > 0) return Math.max(...platforms);
  const tools = versions(join(sdk, "build-tools"), "");
  if (tools.length > 0) return Math.max(...tools);
  return 36;
};

const gradleName = (name: string): string => name.replace(/^\.+|\.+$/g, "").replace(/[^\w -]/g, "") || "app";

const xml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const tokensOf = (mobile: ResolvedMobile, targetSdk: number): Record<string, string> => ({
  APP_ID: mobile.appId,
  APP_NAME: xml(mobile.name),
  GRADLE_NAME: gradleName(mobile.name),
  VERSION_NAME: mobile.version.name,
  VERSION_CODE: String(mobile.version.code),
  ORIENTATION: mobile.orientation,
  MIN_SDK: String(mobile.minSdk),
  TARGET_SDK: String(targetSdk),
  BASE_PATH: mobile.base,
});

const fill = (text: string, tokens: Record<string, string>): string => {
  let out = text;
  for (const [token, value] of Object.entries(tokens)) out = out.replaceAll(`__${token}__`, value);
  return out;
};

const render = (relative: string, tokens: Record<string, string>): string => fill(readFileSync(join(TEMPLATE, relative), "utf8"), tokens);

const walk = (source: string, target: string, tokens: Record<string, string>, relative = ""): void => {
  for (const entry of readdirSync(join(source, relative))) {
    const next = relative === "" ? entry : `${relative}/${entry}`;
    const from = join(source, next);
    const to = join(target, next);
    if (statSync(from).isDirectory()) {
      mkdirSync(to, { recursive: true });
      walk(source, target, tokens, next);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    if (BINARY.test(entry)) cpSync(from, to);
    else writeFileSync(to, render(next, tokens), "utf8");
  }
};

/** Write the whole shell into `mobile/android`, applying the config. */
export const writeAndroid = (project: string, mobile: ResolvedMobile, targetSdk: number): void => {
  const target = androidDir(project);
  mkdirSync(target, { recursive: true });
  walk(TEMPLATE, target, tokensOf(mobile, targetSdk));
  chmodSync(join(target, "gradlew"), 0o755);
};

/** Rewrite only the files the config feeds, leaving the project's other edits alone. */
export const rewriteAndroid = (project: string, mobile: ResolvedMobile, targetSdk: number): void => {
  const target = androidDir(project);
  const tokens = tokensOf(mobile, targetSdk);
  for (const relative of CONFIG_FILES) {
    mkdirSync(dirname(join(target, relative)), { recursive: true });
    writeFileSync(join(target, relative), render(relative, tokens), "utf8");
  }
};

/** Point Gradle at the SDK, so a build needs no `ANDROID_HOME` in its own environment. */
export const writeLocalProperties = (project: string, env: NodeJS.ProcessEnv): void => {
  const sdk = sdkDirOf(env);
  if (sdk === null) return;
  writeFileSync(join(androidDir(project), "local.properties"), `sdk.dir=${sdk}\n`, "utf8");
};
