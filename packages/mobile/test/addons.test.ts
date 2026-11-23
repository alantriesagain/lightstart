// node-only
/**
 * @file Discover the Android add-ons a project's dependencies declare: found,
 * sorted by package name, disabled, warned when a disable name matches nothing,
 * and refused with the package and field when a declaration is bad.
 */

import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { discoverAddons } from "../node/addons.ts";

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
    eq("a permission is kept", echo?.permissions.map((permission) => permission.name).join(",") ?? "", "android.permission.RECORD_AUDIO");
    eq("a feature is kept with required", echo?.features.map((feature) => `${feature.name}:${String(feature.required)}`).join(",") ?? "", "android.hardware.microphone:false");
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
  done();
};

main();
