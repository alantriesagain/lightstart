// node-only
/**
 * @file `light mobile:sync` builds the app, copies it under the shell's assets,
 * and rewrites the config-derived files after `src/mobile` changed.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-mobile-sync-"));
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
    eqn("mobile:init exits 0", run(project, ["mobile:init"]).status, 0);

    writeFileSync(join(project, "src", "mobile.js"), `import { defineMobile } from "@lightstart/mobile";

export default defineMobile({
  appId: "com.example.changed",
  name: "Changed",
  version: { name: "2.0.0", code: 7 },
  orientation: "landscape",
  minSdk: 28,
  shareTarget: { path: "/listen", types: ["audio/*"] },
});
`);

    const synced = run(project, ["mobile:sync"]);
    eqn("mobile:sync exits 0", synced.status, 0);
    if (synced.status !== 0) console.log(synced.output);

    ok("the built page is under assets/www", existsSync(join(project, "mobile", "android", "app", "src", "main", "assets", "www", "index.html")));
    ok("the build ran", existsSync(join(project, ".deployed", "current")));
    ok("the new app id reaches build.gradle", text(project, "app/build.gradle").includes("applicationId 'com.example.changed'"));
    ok("the new version reaches build.gradle", text(project, "app/build.gradle").includes("versionName '2.0.0'") && text(project, "app/build.gradle").includes("versionCode 7"));
    ok("the new minSdk reaches build.gradle", text(project, "app/build.gradle").includes("minSdk 28"));
    ok("the new orientation reaches build.gradle", text(project, "app/build.gradle").includes('"ORIENTATION", \'"landscape"\''));
    ok("the new name reaches strings.xml", text(project, "app/src/main/res/values/strings.xml").includes(">Changed<"));
    const manifest = text(project, "app/src/main/AndroidManifest.xml");
    ok("a changed shareTarget reaches the manifest", manifest.includes('android:mimeType="audio/*"'));
    ok("the old share types leave the manifest", !manifest.includes('android:mimeType="image/*"') && !manifest.includes('android:mimeType="video/*"'));
    ok("removing cameraApp removes the query", !manifest.includes("<queries>"));
    ok("the new shareTarget reaches build.gradle", text(project, "app/build.gradle").includes("/listen|audio/*"));
    ok("no template placeholders remain after sync", !/__[A-Z_]+__/.test(manifest));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

main();
