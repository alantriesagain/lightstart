// node-only
/**
 * @file `light mobile:init` picks up `@lightstart/play-billing`'s Android
 * add-on: its Kotlin lands in the shell, `Addons.kt` lists it, and its billing
 * permission and Play Billing dependency reach the manifest and
 * `build.gradle`.
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
  const project = mkdtempSync(join(tmpdir(), "light-play-billing-addon-"));
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
    ok("PlayBillingAddon.kt is copied", existsSync(join(addonsDir, "PlayBillingAddon.kt")));
    ok("Addons.kt lists PlayBillingAddon()", text(project, "app/src/main/java/dev/lightstart/mobile/Addons.kt").includes("PlayBillingAddon()"));

    const manifest = text(project, "app/src/main/AndroidManifest.xml");
    ok("the billing permission is declared", manifest.includes('android:name="com.android.vending.BILLING"'));

    const gradle = text(project, "app/build.gradle");
    ok("build.gradle has the billing library at the source's version", gradle.includes("implementation 'com.android.billingclient:billing:8.3.0'"));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

main();
