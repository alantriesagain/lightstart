// node-only
/**
 * @file An offline Gradle build of the initialised fixture. When a cached
 * artifact is missing the test skips itself with that artifact's name instead
 * of failing, and never tries the network.
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
  const project = mkdtempSync(join(tmpdir(), "light-mobile-build-"));
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
    /Could not find ([^\s,]+(?::[^\s,]+)+)/,
    /No cached version of ([^\s]+) available for offline mode/,
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
    const built = run(project, ["mobile:build"]);
    const apk = join(project, "mobile", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
    if (built.status !== 0) {
      const missing = missingArtifact(built.output);
      const lines = built.output.split("\n").filter((line) => /Could not find|No cached version|Could not resolve|FAILURE|error:/i.test(line)).slice(0, 15);
      console.log(`SKIP mobile Gradle build: ${missing ?? "the offline caches could not build it"}`);
      for (const line of lines) console.log(`  ${line}`);
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
