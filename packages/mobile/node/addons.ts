/**
 * @file Discover the Android add-ons a project depends on: a package whose
 * `package.json` carries `light.android` ships Kotlin sources the generated
 * shell compiles and dispatches to. A project may opt one out with
 * `defineMobile({ addons: { disable: [...] } })`.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MobileAddonsConfig } from "../index.ts";

/** One `<uses-permission>` an add-on needs, with Android's optional maximum API and flags. */
export interface MobileAddonPermission {
  name: string;
  maxSdkVersion?: number;
  usesPermissionFlags?: string;
}

/** One `<uses-feature>` an add-on needs. */
export interface MobileAddonFeature {
  name: string;
  required?: boolean;
}

/** One `<service>` an add-on declares, as a class name in its own Kotlin sources. */
export interface MobileAddonService {
  name: string;
  foregroundServiceType?: string;
  exported?: boolean;
}

/** A package's `light.android` declaration, as read and validated. */
export interface MobileAddon {
  package: string;
  dir: string;
  sources: string;
  entry: string;
  permissions: MobileAddonPermission[];
  features: MobileAddonFeature[];
  services: MobileAddonService[];
  dependencies: string[];
}

/** The permissions, features and services the add-ons together ask the manifest for. */
export interface AddonUses {
  permissions: MobileAddonPermission[];
  features: MobileAddonFeature[];
  services: MobileAddonService[];
}

/** Android's foreground service types, the values `android:foregroundServiceType` accepts. */
const FOREGROUND_SERVICE_TYPES = [
  "camera",
  "connectedDevice",
  "dataSync",
  "location",
  "mediaPlayback",
  "mediaProjection",
  "microphone",
  "phoneCall",
  "remoteMessaging",
  "shortService",
  "specialUse",
  "systemExempted",
  "health",
];

const FLAGS = /^[A-Za-z]+(?:\|[A-Za-z]+)*$/;
const CLASS_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  if (maxSdkVersion !== undefined && (typeof maxSdkVersion !== "number" || !Number.isInteger(maxSdkVersion) || maxSdkVersion <= 0))
    throw new Error(`${addon} has light.android.permissions[${index}].maxSdkVersion that is not a positive integer`);
  const usesPermissionFlags = value["usesPermissionFlags"];
  if (usesPermissionFlags !== undefined && (typeof usesPermissionFlags !== "string" || !FLAGS.test(usesPermissionFlags)))
    throw new Error(`${addon} has light.android.permissions[${index}].usesPermissionFlags that is not a "|"-separated list of flag names`);
  const permission: MobileAddonPermission = { name };
  if (maxSdkVersion !== undefined) permission.maxSdkVersion = maxSdkVersion;
  if (usesPermissionFlags !== undefined) permission.usesPermissionFlags = usesPermissionFlags;
  return permission;
};

const serviceOf = (value: unknown, addon: string, index: number): MobileAddonService => {
  if (!isRecord(value)) throw new Error(`${addon} has light.android.services[${index}] that is not an object; use { name, foregroundServiceType?, exported? }`);
  const name = value["name"];
  if (!nonEmpty(name) || !CLASS_NAME.test(name))
    throw new Error(`${addon} has light.android.services[${index}].name that is not a Kotlin class name`);
  const foregroundServiceType = value["foregroundServiceType"];
  if (foregroundServiceType !== undefined) {
    if (typeof foregroundServiceType !== "string" || foregroundServiceType === "" || !foregroundServiceType.split("|").every((type) => FOREGROUND_SERVICE_TYPES.includes(type)))
      throw new Error(
        `${addon} has light.android.services[${index}].foregroundServiceType that is not a "|"-separated set of Android foreground service types (${FOREGROUND_SERVICE_TYPES.join(", ")})`,
      );
  }
  const exported = value["exported"];
  if (exported !== undefined && typeof exported !== "boolean")
    throw new Error(`${addon} has light.android.services[${index}].exported that is not a boolean`);
  const service: MobileAddonService = { name };
  if (foregroundServiceType !== undefined) service.foregroundServiceType = foregroundServiceType;
  if (exported !== undefined) service.exported = exported;
  return service;
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
  if (!isRecord(value)) throw new Error(`${pkg} has light.android that is not an object; declare sources, entry, permissions, features, services or dependencies`);
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
    services: listOf(value["services"], pkg, "services", (service, index) => serviceOf(service, pkg, index)),
    dependencies,
  };
};

const dependenciesOf = (project: string): string[] => {
  const manifest = readJson(join(project, "package.json"));
  const dependencies = manifest?.["dependencies"];
  return isRecord(dependencies) ? Object.keys(dependencies).sort() : [];
};

const samePermission = (a: MobileAddonPermission, b: MobileAddonPermission): boolean =>
  a.name === b.name && a.maxSdkVersion === b.maxSdkVersion && a.usesPermissionFlags === b.usesPermissionFlags;

const sameService = (a: MobileAddonService, b: MobileAddonService): boolean =>
  a.name === b.name && a.foregroundServiceType === b.foregroundServiceType && a.exported === b.exported;

/**
 * Merge what the add-ons ask the manifest for, keeping each name once. Two
 * add-ons that declare one permission with different flags or `maxSdkVersion`,
 * or one service name, are an error naming both packages.
 */
export const mergeAddonUses = (addons: MobileAddon[]): AddonUses => {
  const permissions: MobileAddonPermission[] = [];
  const permissionOwners = new Map<string, { addon: string; permission: MobileAddonPermission }>();
  const features: MobileAddonFeature[] = [];
  const featureOwners = new Map<string, string>();
  const services: MobileAddonService[] = [];
  const serviceOwners = new Map<string, { addon: string; service: MobileAddonService }>();
  for (const addon of addons) {
    for (const permission of addon.permissions) {
      const owner = permissionOwners.get(permission.name);
      if (owner === undefined) {
        permissionOwners.set(permission.name, { addon: addon.package, permission });
        permissions.push(permission);
        continue;
      }
      if (!samePermission(owner.permission, permission))
        throw new Error(`Add-ons ${owner.addon} and ${addon.package} both declare ${permission.name} with different flags or maxSdkVersion; make their declarations equal`);
    }
    for (const feature of addon.features) {
      if (featureOwners.has(feature.name)) continue;
      featureOwners.set(feature.name, addon.package);
      features.push(feature);
    }
    for (const service of addon.services) {
      const owner = serviceOwners.get(service.name);
      if (owner === undefined) {
        serviceOwners.set(service.name, { addon: addon.package, service });
        services.push(service);
        continue;
      }
      if (owner.addon !== addon.package)
        throw new Error(`Add-ons ${owner.addon} and ${addon.package} both declare service ${service.name}; rename one of them`);
      if (!sameService(owner.service, service))
        throw new Error(`${addon.package} declares service ${service.name} twice with different settings; make its declarations equal`);
    }
  }
  return { permissions, features, services };
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
  const enabled = addons.filter((addon) => !disabled.has(addon.package));
  mergeAddonUses(enabled);
  return { addons: enabled, warnings };
};
