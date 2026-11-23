/**
 * @file Discover the Android add-ons a project depends on: a package whose
 * `package.json` carries `light.android` ships Kotlin sources the generated
 * shell compiles and dispatches to. A project may opt one out with
 * `defineMobile({ addons: { disable: [...] } })`.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MobileAddonsConfig } from "../index.ts";

/** One `<uses-permission>` an add-on needs, with Android's optional maximum API. */
export interface MobileAddonPermission {
  name: string;
  maxSdkVersion?: number;
}

/** One `<uses-feature>` an add-on needs. */
export interface MobileAddonFeature {
  name: string;
  required?: boolean;
}

/** A package's `light.android` declaration, as read and validated. */
export interface MobileAddon {
  package: string;
  dir: string;
  sources: string;
  entry: string;
  permissions: MobileAddonPermission[];
  features: MobileAddonFeature[];
  dependencies: string[];
}

/** What discovery found, plus the warnings the commands print. */
export interface AddonDiscovery {
  addons: MobileAddon[];
  warnings: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
};

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

const permissionOf = (value: unknown, addon: string, index: number): MobileAddonPermission => {
  if (typeof value === "string") {
    if (!nonEmpty(value)) throw new Error(`${addon} has light.android.permissions[${index}] that is empty; give an Android permission name`);
    return { name: value };
  }
  if (!isRecord(value)) throw new Error(`${addon} has light.android.permissions[${index}] that is not a string or an object; use { name, maxSdkVersion? }`);
  const name = value["name"];
  if (!nonEmpty(name)) throw new Error(`${addon} has light.android.permissions[${index}].name that is not a permission name`);
  const maxSdkVersion = value["maxSdkVersion"];
  if (maxSdkVersion === undefined) return { name };
  if (typeof maxSdkVersion !== "number" || !Number.isInteger(maxSdkVersion) || maxSdkVersion <= 0)
    throw new Error(`${addon} has light.android.permissions[${index}].maxSdkVersion that is not a positive integer`);
  return { name, maxSdkVersion };
};

const featureOf = (value: unknown, addon: string, index: number): MobileAddonFeature => {
  if (!isRecord(value)) throw new Error(`${addon} has light.android.features[${index}] that is not an object; use { name, required? }`);
  const name = value["name"];
  if (!nonEmpty(name)) throw new Error(`${addon} has light.android.features[${index}].name that is not a feature name`);
  const required = value["required"];
  if (required !== undefined && typeof required !== "boolean")
    throw new Error(`${addon} has light.android.features[${index}].required that is not a boolean`);
  const feature: MobileAddonFeature = { name };
  if (required !== undefined) feature.required = required;
  return feature;
};

const listOf = <T>(value: unknown, addon: string, field: string, item: (entry: unknown, index: number) => T): T[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${addon} has light.android.${field} that is not a list`);
  return value.map((entry, index) => item(entry, index));
};

const addonOf = (pkg: string, dir: string, value: unknown): MobileAddon => {
  if (!isRecord(value)) throw new Error(`${pkg} has light.android that is not an object; declare sources, entry, permissions, features or dependencies`);
  const sources = value["sources"] ?? "android";
  if (!nonEmpty(sources) || sources.startsWith("/") || sources.split("/").includes(".."))
    throw new Error(`${pkg} has light.android.sources that is not a folder relative to the package`);
  const sourceDir = join(dir, sources);
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory())
    throw new Error(`${pkg} has light.android.sources "${sources}" that is not a folder`);
  const entry = value["entry"];
  if (!nonEmpty(entry) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry))
    throw new Error(`${pkg} has light.android.entry that is not a Kotlin class name`);
  const dependencies = listOf(value["dependencies"], pkg, "dependencies", (dependency, index) => {
    if (!nonEmpty(dependency)) throw new Error(`${pkg} has light.android.dependencies[${index}] that is not a Gradle coordinate`);
    return dependency;
  });
  return {
    package: pkg,
    dir,
    sources,
    entry,
    permissions: listOf(value["permissions"], pkg, "permissions", (permission, index) => permissionOf(permission, pkg, index)),
    features: listOf(value["features"], pkg, "features", (feature, index) => featureOf(feature, pkg, index)),
    dependencies,
  };
};

const dependenciesOf = (project: string): string[] => {
  const manifest = readJson(join(project, "package.json"));
  const dependencies = manifest?.["dependencies"];
  return isRecord(dependencies) ? Object.keys(dependencies).sort() : [];
};

/**
 * Read the project's `dependencies`, keep those whose package declares
 * `light.android`, sort them by package name, and validate each declaration.
 * A disabled name that names no discovered add-on is returned as a warning.
 */
export const discoverAddons = (project: string, options: MobileAddonsConfig = {}): AddonDiscovery => {
  const addons: MobileAddon[] = [];
  for (const pkg of dependenciesOf(project)) {
    const dir = join(project, "node_modules", ...pkg.split("/"));
    const manifest = readJson(join(dir, "package.json"));
    const light = manifest?.["light"];
    if (!isRecord(light) || light["android"] === undefined) continue;
    addons.push(addonOf(pkg, dir, light["android"]));
  }
  addons.sort((a, b) => a.package.localeCompare(b.package));
  const disabled = new Set(options.disable ?? []);
  const warnings: string[] = [];
  for (const name of disabled) {
    if (!addons.some((addon) => addon.package === name))
      warnings.push(`addons.disable names ${name}, which is not a discovered Android add-on`);
  }
  return { addons: addons.filter((addon) => !disabled.has(addon.package)), warnings };
};
