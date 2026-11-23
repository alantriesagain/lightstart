// node-only
/**
 * @file Discover the Android add-ons a project's dependencies declare: found,
 * sorted by package name, disabled, warned when a disable name matches nothing,
 * and refused with the package and field when a declaration is bad.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { discoverAddons, mergeAddonUses } from "../node/addons.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));

const projectWith = (dependencies: string[]): string => {
  const project = mkdtempSync(join(tmpdir(), "light-mobile-addons-"));
  const manifest = {
    name: "addons-fixture",
    version: "0.0.0",
    type: "module",
    dependencies: Object.fromEntries(dependencies.map((name) => [name, "*"])),
  };
  writeFileSync(join(project, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const projectWithDeclarations = (declarations: Record<string, Record<string, unknown>>): string => {
  const project = mkdtempSync(join(tmpdir(), "light-mobile-addons-"));
  const manifest = {
    name: "addons-fixture",
    version: "0.0.0",
    type: "module",
    dependencies: Object.fromEntries(Object.keys(declarations).map((name) => [name, "*"])),
  };
  writeFileSync(join(project, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [name, declaration] of Object.entries(declarations)) {
    const dir = join(project, "node_modules", ...name.split("/"));
    mkdirSync(join(dir, "android"), { recursive: true });
    const android = { sources: "android", entry: "DemoAddon", ...declaration };
    writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name, version: "0.0.0", light: { android } }, null, 2)}\n`);
  }
  return project;
};

const messageOf = (fn: () => void): string => {
  try {
    fn();
    return "";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

const main = (): void => {
  const project = projectWith(["@fixture/gradle-addon", "@fixture/echo-addon"]);
  try {
    const found = discoverAddons(project);
    eq("both add-ons are found, sorted by package name", found.addons.map((addon) => addon.package).join(","), "@fixture/echo-addon,@fixture/gradle-addon");
    eq("discovery has no warnings", found.warnings.join(","), "");
    const echo = found.addons[0];
    eq("the entry is kept", echo?.entry ?? "", "EchoAddon");
    eq("the sources folder is kept", echo?.sources ?? "", "android");
    eq("permissions are kept", echo?.permissions.map((permission) => permission.name).join(",") ?? "", "android.permission.RECORD_AUDIO,android.permission.BLUETOOTH_SCAN");
    eq("the permission flags are kept", echo?.permissions.find((permission) => permission.name === "android.permission.BLUETOOTH_SCAN")?.usesPermissionFlags ?? "", "neverForLocation");
    eq("a feature is kept with required", echo?.features.map((feature) => `${feature.name}:${String(feature.required)}`).join(",") ?? "", "android.hardware.microphone:false");
    eq("a service is kept", echo?.services.map((service) => `${service.name}:${service.foregroundServiceType ?? ""}`).join(",") ?? "", "EchoService:dataSync");
    const gradle = found.addons[1];
    eq("a Gradle dependency is kept", gradle?.dependencies.join(",") ?? "", "com.example:demo:1.0.0");

    const disabled = discoverAddons(project, { disable: ["@fixture/echo-addon"] });
    eq("a disabled add-on is left out", disabled.addons.map((addon) => addon.package).join(","), "@fixture/gradle-addon");
    const unknown = discoverAddons(project, { disable: ["@fixture/missing"] });
    eqn("a disable name that matches nothing is still discovered", unknown.addons.length, 2);
    ok("a disable name that matches nothing warns", unknown.warnings.some((warning) => warning.includes("@fixture/missing")));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  const bad = projectWith(["@fixture/bad-addon"]);
  try {
    const message = messageOf(() => {
      discoverAddons(bad);
    });
    ok("a bad field names the package", message.includes("@fixture/bad-addon"));
    ok("a bad field names the field", message.includes("light.android.entry"));
  } finally {
    rmSync(bad, { recursive: true, force: true });
  }

  const missing = projectWith(["@fixture/missing"]);
  try {
    eqn("a dependency without light.android is not an add-on", discoverAddons(missing).addons.length, 0);
  } finally {
    rmSync(missing, { recursive: true, force: true });
  }

  const badFlag = projectWithDeclarations({
    "@fixture/bad-flag": { permissions: [{ name: "android.permission.BLUETOOTH_SCAN", usesPermissionFlags: "never_location" }] },
  });
  try {
    const message = messageOf(() => {
      discoverAddons(badFlag);
    });
    ok("a bad permission flag names the package", message.includes("@fixture/bad-flag"));
    ok("a bad permission flag names the field", message.includes("usesPermissionFlags"));
  } finally {
    rmSync(badFlag, { recursive: true, force: true });
  }

  const badServiceName = projectWithDeclarations({
    "@fixture/bad-service-name": { services: [{ name: "Not A Class" }] },
  });
  try {
    const message = messageOf(() => {
      discoverAddons(badServiceName);
    });
    ok("a bad service name names the package", message.includes("@fixture/bad-service-name"));
    ok("a bad service name names the class field", message.includes("services[0].name"));
  } finally {
    rmSync(badServiceName, { recursive: true, force: true });
  }

  const badServiceType = projectWithDeclarations({
    "@fixture/bad-service-type": { services: [{ name: "LinkService", foregroundServiceType: "bogusType" }] },
  });
  try {
    const message = messageOf(() => {
      discoverAddons(badServiceType);
    });
    ok("a bad service type names the package", message.includes("@fixture/bad-service-type"));
    ok("a bad service type names the field", message.includes("foregroundServiceType"));
  } finally {
    rmSync(badServiceType, { recursive: true, force: true });
  }

  const clash = projectWithDeclarations({
    "@fixture/clash-a": { permissions: [{ name: "android.permission.BLUETOOTH_SCAN", usesPermissionFlags: "neverForLocation" }] },
    "@fixture/clash-b": { permissions: [{ name: "android.permission.BLUETOOTH_SCAN" }] },
  });
  try {
    const message = messageOf(() => {
      discoverAddons(clash);
    });
    ok("a clashing permission names both packages", message.includes("@fixture/clash-a") && message.includes("@fixture/clash-b"));
    ok("a clashing permission names the permission", message.includes("android.permission.BLUETOOTH_SCAN"));
  } finally {
    rmSync(clash, { recursive: true, force: true });
  }

  const equal = projectWithDeclarations({
    "@fixture/equal-a": { permissions: [{ name: "android.permission.BLUETOOTH_SCAN", usesPermissionFlags: "neverForLocation" }] },
    "@fixture/equal-b": { permissions: [{ name: "android.permission.BLUETOOTH_SCAN", usesPermissionFlags: "neverForLocation" }] },
  });
  try {
    const found = discoverAddons(equal);
    const uses = mergeAddonUses(found.addons);
    eqn("equal duplicate permissions merge to one", uses.permissions.length, 1);
    eq("the merged permission keeps its flags", uses.permissions[0]?.usesPermissionFlags ?? "", "neverForLocation");
  } finally {
    rmSync(equal, { recursive: true, force: true });
  }
  done();
};

main();
