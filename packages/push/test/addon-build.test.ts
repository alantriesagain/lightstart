// node-only
/**
 * @file An offline Gradle build of a shell carrying the push add-on. When a
 * cached artifact is missing the test skips itself with that artifact's name;
 * any other failure, a compile error among them, fails it. It never tries the
 * network. Firebase Messaging is not in the offline cache, so on this machine
 * the test skips naming `com.google.firebase:firebase-messaging`.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-push-build-"));
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
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};

const missingArtifact = (output: string): string | null => {
  const patterns = [
    /No cached version of ([^\s]+) available for offline mode/,
    /Could not find ([^\s,]+(?::[^\s,]+)+)/,
    /Could not download ([^\s]+)/,
    /Could not resolve ([^\s,]+(?::[^\s,]+)+)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(output);
    if (match !== null) return match[1] ?? null;
  }
  return null;
};

const main = (): void => {
  const project = copy();
  try {
    eqn("mobile:init exits 0", run(project, ["mobile:init"]).status, 0);
    ok("the push add-on reached the shell", existsSync(join(project, "mobile", "android", "app", "src", "main", "java", "dev", "lightstart", "mobile", "addons", "PushAddon.kt")));
    const built = run(project, ["mobile:build"]);
    const apk = join(project, "mobile", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
    if (built.status !== 0) {
      const missing = missingArtifact(built.output);
      const lines = built.output.split("\n").filter((line) => /Could not find|No cached version|Could not resolve|FAILURE|error:|^e: /i.test(line)).slice(0, 15);
      if (missing !== null) console.log(`SKIP push Gradle build: ${missing} is not in the offline cache`);
      for (const line of lines) console.log(`  ${line}`);
      ok("the offline build fails only on an artifact the cache lacks", missing !== null);
    } else {
      eqn("the APK exists", existsSync(apk) ? 0 : 1, 0);
      if (existsSync(apk)) console.log(`APK ${apk} (${statSync(apk).size} bytes)`);
      ok("the APK is not empty", existsSync(apk) && statSync(apk).size > 0);
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

main();
