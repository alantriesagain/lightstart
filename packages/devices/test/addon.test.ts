// node-only
/**
 * @file `light mobile:init` picks up `@lightstart/devices`'s Android add-on:
 * its Kotlin lands in the shell, `Addons.kt` lists it, and its permissions,
 * service and media3 coordinates reach the manifest and `build.gradle`.
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
  const project = mkdtempSync(join(tmpdir(), "light-devices-addon-"));
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
    for (const file of ["DevicesAddon.kt", "DevicesBleManager.kt", "DevicesWifiJoiner.kt", "DevicesDownloader.kt", "DevicesUdpDataSource.kt", "DevicesStreamPlayer.kt", "DeviceLinkService.kt", "DevicesCommands.kt"]) {
      ok(`${file} is copied`, existsSync(join(addonsDir, file)));
    }
    ok("Addons.kt lists DevicesAddon()", text(project, "app/src/main/java/dev/lightstart/mobile/Addons.kt").includes("DevicesAddon()"));

    const manifest = text(project, "app/src/main/AndroidManifest.xml");
    ok("BLUETOOTH_SCAN is a permission", manifest.includes('android:name="android.permission.BLUETOOTH_SCAN"'));
    ok("BLUETOOTH_SCAN never asks for location", manifest.includes('android:usesPermissionFlags="neverForLocation"'));
    ok("BLUETOOTH_CONNECT is a permission", manifest.includes('android:name="android.permission.BLUETOOTH_CONNECT"'));
    ok("the legacy Bluetooth permissions stop at API 30", manifest.includes('android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"'));
    ok("the foreground service permission is declared", manifest.includes('android:name="android.permission.FOREGROUND_SERVICE"'));
    ok("the connected-device foreground permission is declared", manifest.includes('android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"'));
    ok("the link service is a connectedDevice service", manifest.includes('android:name="dev.lightstart.mobile.addons.DeviceLinkService"') && manifest.includes('android:foregroundServiceType="connectedDevice"'));

    const gradle = text(project, "app/build.gradle");
    for (const coordinate of ["androidx.media3:media3-exoplayer:1.9.0", "androidx.media3:media3-datasource:1.9.0"]) {
      ok(`build.gradle has ${coordinate}`, gradle.includes(`implementation '${coordinate}'`));
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

main();
