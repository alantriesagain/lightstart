// node-only
/**
 * @file The mobile config: its defaults, a required appId, and the error for
 * both `src/mobile.js` and `src/mobile.ts`.
 */

import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { readMobile, resolveMobile } from "../node/config.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-mobile-config-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => path === fixture || (!path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed")),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const pause = async (): Promise<void> => await new Promise((resolve) => setTimeout(resolve, 5));

const main = async (): Promise<void> => {
  const defaults = resolveMobile({ appId: "com.example.app" }, { name: "budget", title: "Budget", base: "" });
  eq("the name defaults to the app's title", defaults.name, "Budget");
  eq("the version name defaults to 0.1.0", defaults.version.name, "0.1.0");
  eqn("the version code defaults to 1", defaults.version.code, 1);
  eq("the orientation defaults to any", defaults.orientation, "any");
  eqn("minSdk defaults to 26", defaults.minSdk, 26);
  eq("the app id is kept", defaults.appId, "com.example.app");
  ok("shareTarget defaults to none", defaults.shareTarget === undefined);
  ok("cameraApp defaults to none", defaults.cameraApp === undefined);

  const one = resolveMobile({ appId: "com.example.app", shareTarget: { path: "/capture", types: ["image/*"] } }, { name: "app", base: "" });
  eq("one shareTarget is kept", one.shareTarget?.map((target) => `${target.path}:${(target.types ?? []).join(",")}`).join(";") ?? "", "/capture:image/*");
  const many = resolveMobile({ appId: "com.example.app", shareTarget: [{ path: "/text" }, { path: "/media", types: ["image/*"] }] }, { name: "app", base: "" });
  eq("a list of shareTargets is kept", many.shareTarget?.map((target) => `${target.path}:${(target.types ?? []).join(",")}`).join(";") ?? "", "/text:text/plain;/media:image/*");
  eq("cameraApp is kept", resolveMobile({ appId: "com.example.app", cameraApp: "com.example.camera" }, { name: "app", base: "" }).cameraApp ?? "", "com.example.camera");
  const badPath = (() => {
    try {
      resolveMobile({ appId: "com.example.app", shareTarget: { path: "capture" } }, { name: "app", base: "" });
      return "";
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error);
    }
  })();
  ok("a shareTarget path must start with /", badPath.includes("must start with"));
  const badCamera = (() => {
    try {
      resolveMobile({ appId: "com.example.app", cameraApp: "com example" }, { name: "app", base: "" });
      return "";
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error);
    }
  })();
  ok("cameraApp must be an application id", badCamera.includes("application id"));

  const project = copy();
  try {
    const config = await readMobile(project);
    ok("the fixture config is read", config !== null);
    if (config !== null) {
      const resolved = resolveMobile(config, { name: "fixture", title: "Fixture", base: "" });
      eq("an explicit name is kept", resolved.name, "Mobile Fixture");
      eq("an explicit version name is kept", resolved.version.name, "1.0.0");
      eqn("an explicit minSdk is kept", resolved.minSdk, 26);
    }

    writeFileSync(join(project, "src", "mobile.js"), "export default {};\n");
    await pause();
    const message = await readMobile(project).then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    ok("a config without appId is an error naming appId", message.includes("appId"));

    writeFileSync(join(project, "src", "mobile.ts"), "import { defineMobile } from \"@lightstart/mobile\";\n\nexport default defineMobile({ appId: \"com.example.other\" });\n");
    await pause();
    const both = await readMobile(project).then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    ok("both src/mobile.ts and src/mobile.js is an error naming both", both.includes("src/mobile.ts") && both.includes("src/mobile.js"));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
