// node-only
/**
 * @file `light mobile:init` picks up `@lightstart/camera`'s Android add-on:
 * its Kotlin lands in the shell, `Addons.kt` lists it, and its permissions,
 * feature and CameraX coordinates reach the manifest and `build.gradle`.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-camera-addon-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => path === fixture || (!path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed")),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const run = (project: string, args: string[]): { status: number; output: string } => {
  const result = spawnSync(process.execPath, ["--no-warnings", cli, ...args], {
    cwd: project,
    env: { ...process.env, LIGHT_PROJECT_DIR: project, NO_COLOR: "1" },
    encoding: "utf8",
  });
  return { status: result.status ?? 1, output: `${result.stdout}${result.stderr}` };
};

const text = (project: string, path: string): string => readFileSync(join(project, "mobile", "android", path), "utf8");

const main = (): void => {
  const project = copy();
  try {
    const init = run(project, ["mobile:init"]);
    eqn("mobile:init exits 0", init.status, 0);
    if (init.status !== 0) console.log(init.output);

    const addonsDir = join(project, "mobile", "android", "app", "src", "main", "java", "dev", "lightstart", "mobile", "addons");
    ok("CameraAddon.kt is copied", existsSync(join(addonsDir, "CameraAddon.kt")));
    ok("Addons.kt lists CameraAddon()", text(project, "app/src/main/java/dev/lightstart/mobile/Addons.kt").includes("CameraAddon()"));

    const manifest = text(project, "app/src/main/AndroidManifest.xml");
    ok("CAMERA is a permission", manifest.includes('android:name="android.permission.CAMERA"'));
    ok("RECORD_AUDIO is a permission", manifest.includes('android:name="android.permission.RECORD_AUDIO"'));
    ok("the camera feature is optional", manifest.includes('android:name="android.hardware.camera.any"') && manifest.includes('android:required="false"'));

    const gradle = text(project, "app/build.gradle");
    const coordinates = [
      "androidx.camera:camera-core:1.6.2",
      "androidx.camera:camera-camera2:1.6.2",
      "androidx.camera:camera-lifecycle:1.6.2",
      "androidx.camera:camera-view:1.6.2",
      "androidx.camera:camera-video:1.6.2",
    ];
    for (const coordinate of coordinates) ok(`build.gradle has ${coordinate}`, gradle.includes(`implementation '${coordinate}'`));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

main();
