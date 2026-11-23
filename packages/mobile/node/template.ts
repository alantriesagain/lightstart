/**
 * @file The Android template and the files the config fills: copy the tree for
 * `mobile:init`, and rewrite only the config-derived files for `mobile:sync`,
 * so a project's own edits survive.
 */

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedMobile } from "../index.ts";
import type { MobileAddon } from "./addons.ts";
import { mergeAddonUses } from "./addons.ts";

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

const gradle = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");

const typesOf = (target: { types?: string[] }): string[] => target.types ?? ["text/plain"];

const shareTargetsToken = (mobile: ResolvedMobile): string =>
  (mobile.shareTarget ?? []).map((target) => `${target.path}|${typesOf(target).join(",")}`).join(";");

const shareIntentFilters = (mobile: ResolvedMobile): string => {
  const filters: string[] = [];
  const seen = new Set<string>();
  for (const target of mobile.shareTarget ?? []) {
    for (const type of typesOf(target)) {
      if (seen.has(type)) continue;
      seen.add(type);
      const actions = type === "text/plain"
        ? '                <action android:name="android.intent.action.SEND" />'
        : '                <action android:name="android.intent.action.SEND" />\n                <action android:name="android.intent.action.SEND_MULTIPLE" />';
      filters.push(
        `            <intent-filter>\n${actions}\n                <category android:name="android.intent.category.DEFAULT" />\n                <data android:mimeType="${xml(type)}" />\n            </intent-filter>`,
      );
    }
  }
  return filters.length === 0 ? "" : `\n${filters.join("\n")}`;
};

const resultTypes = (mobile: ResolvedMobile): string[] => mobile.resultTarget?.types ?? ["image/*", "video/*"];

const resultActivitiesToken = (mobile: ResolvedMobile): string => {
  const target = mobile.resultTarget;
  if (target === undefined) return "";
  const types = resultTypes(mobile);
  const image = types.some((type) => type === "image/*" || type.startsWith("image/"));
  const video = types.some((type) => type === "video/*" || type.startsWith("video/"));
  const filters: string[] = [];
  if (target.capture !== undefined) {
    const actions: string[] = [];
    if (image) actions.push('                <action android:name="android.media.action.IMAGE_CAPTURE" />');
    if (video) actions.push('                <action android:name="android.media.action.VIDEO_CAPTURE" />');
    filters.push(
      `            <intent-filter>\n${actions.join("\n")}\n                <category android:name="android.intent.category.DEFAULT" />\n            </intent-filter>`,
    );
  }
  if (target.pick !== undefined) {
    const data = types.map((type) => `                <data android:mimeType="${xml(type)}" />`).join("\n");
    filters.push(
      `            <intent-filter>\n                <action android:name="android.intent.action.GET_CONTENT" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.OPENABLE" />\n${data}\n            </intent-filter>`,
    );
    filters.push(
      `            <intent-filter>\n                <action android:name="android.intent.action.PICK" />\n                <category android:name="android.intent.category.DEFAULT" />\n${data}\n            </intent-filter>`,
    );
  }
  return `\n\n        <activity\n            android:name="dev.lightstart.mobile.ResultActivity"\n            android:exported="true"\n            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|uiMode"\n            android:windowSoftInputMode="adjustResize">\n${filters.join("\n")}\n        </activity>`;
};

const queriesToken = (mobile: ResolvedMobile): string =>
  mobile.cameraApp === undefined
    ? ""
    : `\n    <queries>\n        <package android:name="${xml(mobile.cameraApp)}" />\n    </queries>`;

const addonUsesToken = (addons: MobileAddon[]): string => {
  const uses = mergeAddonUses(addons);
  const lines: string[] = [];
  for (const permission of uses.permissions) {
    const max = permission.maxSdkVersion === undefined ? "" : ` android:maxSdkVersion="${String(permission.maxSdkVersion)}"`;
    const flags = permission.usesPermissionFlags === undefined ? "" : ` android:usesPermissionFlags="${xml(permission.usesPermissionFlags)}"`;
    lines.push(`\n    <uses-permission android:name="${xml(permission.name)}"${max}${flags} />`);
  }
  for (const feature of uses.features) {
    const required = feature.required === undefined ? "" : ` android:required="${feature.required ? "true" : "false"}"`;
    lines.push(`\n    <uses-feature android:name="${xml(feature.name)}"${required} />`);
  }
  return lines.join("");
};

const addonServicesToken = (addons: MobileAddon[]): string =>
  mergeAddonUses(addons)
    .services.map((service) => {
      const type = service.foregroundServiceType === undefined ? "" : ` android:foregroundServiceType="${xml(service.foregroundServiceType)}"`;
      return `\n\n        <service android:name="dev.lightstart.mobile.addons.${service.name}" android:exported="${service.exported === true ? "true" : "false"}"${type} />`;
    })
    .join("");

const addonDependenciesToken = (addons: MobileAddon[]): string => {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const addon of addons) {
    for (const dependency of addon.dependencies) {
      if (seen.has(dependency)) continue;
      seen.add(dependency);
      lines.push(`\n    implementation '${gradle(dependency)}'`);
    }
  }
  return lines.join("");
};

const tokensOf = (mobile: ResolvedMobile, targetSdk: number, addons: MobileAddon[]): Record<string, string> => ({
  APP_ID: mobile.appId,
  APP_NAME: xml(mobile.name),
  GRADLE_NAME: gradleName(mobile.name),
  VERSION_NAME: mobile.version.name,
  VERSION_CODE: String(mobile.version.code),
  ORIENTATION: mobile.orientation,
  MIN_SDK: String(mobile.minSdk),
  TARGET_SDK: String(targetSdk),
  BASE_PATH: mobile.base,
  SHARE_TARGETS: gradle(shareTargetsToken(mobile)),
  RESULT_CAPTURE: gradle(mobile.resultTarget?.capture ?? ""),
  RESULT_PICK: gradle(mobile.resultTarget?.pick ?? ""),
  CAMERA_APP: gradle(mobile.cameraApp ?? ""),
  SHARE_INTENT_FILTERS: shareIntentFilters(mobile),
  RESULT_ACTIVITIES: resultActivitiesToken(mobile),
  ADDON_USES: addonUsesToken(addons),
  ADDON_SERVICES: addonServicesToken(addons),
  ADDON_DEPENDENCIES: addonDependenciesToken(addons),
  QUERIES: queriesToken(mobile),
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

const addonsKotlin = (addons: MobileAddon[]): string => {
  const imports = addons.map((addon) => `import dev.lightstart.mobile.addons.${addon.entry}`);
  const header = imports.length === 0 ? "" : `${imports.join("\n")}\n\n`;
  const entries = addons.map((addon) => `        ${addon.entry}(),`).join("\n");
  const body = entries.length === 0 ? "listOf()" : `listOf(\n${entries}\n    )`;
  return `package dev.lightstart.mobile\n\n${header}/** The add-ons this shell compiles, in package order. */\nobject Addons {\n    fun create(): List<MobileAddon> = ${body}\n}\n`;
};

/** Copy every add-on's Kotlin sources and write `Addons.kt`, clearing the files a removed add-on left. */
export const writeAddons = (project: string, addons: MobileAddon[]): void => {
  const packageDir = join(androidDir(project), "app", "src", "main", "java", "dev", "lightstart", "mobile");
  const addonsDir = join(packageDir, "addons");
  rmSync(addonsDir, { recursive: true, force: true });
  mkdirSync(addonsDir, { recursive: true });
  const owners = new Map<string, string>();
  for (const addon of addons) {
    const sourceDir = join(addon.dir, addon.sources);
    for (const entry of readdirSync(sourceDir)) {
      if (!entry.endsWith(".kt") || !statSync(join(sourceDir, entry)).isFile()) continue;
      const owner = owners.get(entry);
      if (owner !== undefined) throw new Error(`Add-ons ${owner} and ${addon.package} both ship ${entry}; rename one of them`);
      owners.set(entry, addon.package);
      cpSync(join(sourceDir, entry), join(addonsDir, entry));
    }
  }
  writeFileSync(join(packageDir, "Addons.kt"), addonsKotlin(addons), "utf8");
};

/** Write the whole shell into `mobile/android`, applying the config and the discovered add-ons. */
export const writeAndroid = (project: string, mobile: ResolvedMobile, targetSdk: number, addons: MobileAddon[] = []): void => {
  const target = androidDir(project);
  mkdirSync(target, { recursive: true });
  walk(TEMPLATE, target, tokensOf(mobile, targetSdk, addons));
  chmodSync(join(target, "gradlew"), 0o755);
  writeAddons(project, addons);
};

/** Rewrite only the files the config feeds, leaving the project's other edits alone, and sync the add-ons. */
export const rewriteAndroid = (project: string, mobile: ResolvedMobile, targetSdk: number, addons: MobileAddon[] = []): void => {
  const target = androidDir(project);
  const tokens = tokensOf(mobile, targetSdk, addons);
  for (const relative of CONFIG_FILES) {
    mkdirSync(dirname(join(target, relative)), { recursive: true });
    writeFileSync(join(target, relative), render(relative, tokens), "utf8");
  }
  writeAddons(project, addons);
};

/** Point Gradle at the SDK, so a build needs no `ANDROID_HOME` in its own environment. */
export const writeLocalProperties = (project: string, env: NodeJS.ProcessEnv): void => {
  const sdk = sdkDirOf(env);
  if (sdk === null) return;
  writeFileSync(join(androidDir(project), "local.properties"), `sdk.dir=${sdk}\n`, "utf8");
};
